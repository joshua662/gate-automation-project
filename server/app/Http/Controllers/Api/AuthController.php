<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ResidentGateAccessWelcomeMail;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    private function generateUsername(string $firstName, string $lastName): string
    {
        $base = strtolower(preg_replace('/[^a-z0-9]/', '', $firstName.Str::substr($lastName, 0, 1)));
        $base = Str::substr($base ?: 'user', 0, 6);

        for ($attempt = 0; $attempt < 50; $attempt++) {
            $candidate = Str::substr($base.random_int(100, 9999), 0, 12);
            if (strlen($candidate) >= 6 && ! User::where('username', $candidate)->exists()) {
                return $candidate;
            }
        }

        return Str::substr($base.bin2hex(random_bytes(4)), 0, 12);
    }

    private function generatePassword(): string
    {
        $chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
        $password = '';
        for ($i = 0; $i < 10; $i++) {
            $password .= $chars[random_int(0, strlen($chars) - 1)];
        }

        return $password;
    }

    private function resolveCredentials(array $validated): array
    {
        $username = $validated['username'] ?? $this->generateUsername(
            $validated['first_name'],
            $validated['last_name'],
        );
        $password = $validated['password'] ?? $this->generatePassword();

        return [$username, $password];
    }

    private function configuredCredentialsRecipients(): array
    {
        $configuredRecipients = env('MAIL_CREDENTIALS_TO')
            ?: env('MAIL_USERNAME');

        return collect(explode(',', (string) $configuredRecipients))
            ->map(fn (string $email) => trim($email))
            ->filter(fn (string $email) => filter_var($email, FILTER_VALIDATE_EMAIL))
            ->values()
            ->all();
    }

    private function credentialRecipientFor(User $user): ?string
    {
        $email = trim((string) $user->email);

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return null;
        }

        return $email;
    }

    private function sendPortalCredentials(User $user, string $plainPassword): ?string
    {
        $credentialsMailbox = $this->credentialRecipientFor($user);

        if ($credentialsMailbox === null) {
            return 'The registered user does not have a valid email address.';
        }

        $credentialsMailbox = trim($credentialsMailbox);

        try {
            \Illuminate\Support\Facades\Log::info("Sending credentials email to: " . $credentialsMailbox);
            Mail::to($credentialsMailbox)->send(new ResidentGateAccessWelcomeMail(
                $user,
                $plainPassword,
                config('gate.portal_url'),
            ));

            return null;
        } catch (\Throwable $e) {
            report($e);

            return 'Credentials were not sent to '.$credentialsMailbox.'. '.$e->getMessage();
        }
    }

    private function registrationResponse(
        User $user,
        string $plainPassword,
        string $message,
        ?string $mailError = null
    ): \Illuminate\Http\JsonResponse
    {
        $user->load('gender');

        return response()->json([
            'message' => $message,
            'mail_sent' => $mailError === null,
            'mail_error' => $mailError,
            'mail_recipient' => $this->credentialRecipientFor($user),
            'user' => $user,
        ], 201);
    }

    private function portalRoleDeniedMessage(string $role, string $expectedPortal): string
    {
        return match ($role) {
            'admin' => 'This account is for the Admin monitoring portal. Please sign in through the Admin Panel.',
            'resident' => 'This account is for the Resident portal. Please use the resident sign-in page.',
            'security_guard' => 'This account is for the Security Guard portal. Please sign in through the Client portal.',
            default => "This account cannot access the {$expectedPortal}.",
        };
    }

    private function authenticatePortalUser(
        Request $request,
        string $loginInput,
        string $password,
        string $expectedRole,
        string $portalLabel,
        callable $onFailure,
        callable $onSuccess,
    ) {
        $user = User::with(['gender'])
            ->where(function ($query) use ($loginInput) {
                $query->where('username', $loginInput)
                    ->orWhere('email', $loginInput);
            })
            ->where('is_deleted', false)
            ->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            $onFailure($request, $loginInput);

            return response()->json([
                'message' => 'The provided credentials are incorrect.',
            ], 401);
        }

        if (! $user->is_approved) {
            return response()->json([
                'message' => 'Your account is pending approval by the administrator.',
            ], 403);
        }

        if ($user->role !== $expectedRole) {
            return response()->json([
                'message' => $this->portalRoleDeniedMessage($user->role, $portalLabel),
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;
        $onSuccess($request, $user);

        return response()->json([
            'user' => $user,
            'token' => $token,
        ], 200);
    }

    public function login(Request $request)
    {
        $loginInput = $request->input('username') ?? $request->input('email') ?? $request->input('login');

        if (! $loginInput) {
            return response()->json([
                'message' => 'The email or username field is required.',
                'errors' => [
                    'username' => ['The email or username field is required.'],
                ],
            ], 422);
        }

        $validated = $request->validate([
            'password' => ['required', 'string'],
        ]);

        $user = User::with(['gender'])
            ->where(function ($query) use ($loginInput) {
                $query->where('username', $loginInput)
                    ->orWhere('email', $loginInput);
            })
            ->where('is_deleted', false)
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            ActivityLogService::loginFailureAdminPortal($request, (string) $loginInput);
            return response()->json(['message' => 'The provided credentials are incorrect.'], 401);
        }

        if (! $user->is_approved) {
            return response()->json(['message' => 'Your account is pending approval by the administrator.'], 403);
        }

        if (! in_array($user->role, ['security_guard', 'resident'])) {
            return response()->json(['message' => 'This account cannot access the Client portal.'], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        if ($user->role === 'resident') {
            ActivityLogService::residentPortalSuccess($request, $user);
        } else {
            ActivityLogService::loginSuccessAdminPortal($request, $user);
        }

        return response()->json([
            'user' => $user,
            'token' => $token,
        ], 200);
    }

    public function adminLogin(Request $request)
    {
        $loginInput = $request->input('username') ?? $request->input('email') ?? $request->input('login');

        if (! $loginInput) {
            return response()->json([
                'message' => 'The email or username field is required.',
                'errors' => [
                    'username' => ['The email or username field is required.'],
                ],
            ], 422);
        }

        $validated = $request->validate([
            'password' => ['required', 'string'],
        ]);

        return $this->authenticatePortalUser(
            $request,
            (string) $loginInput,
            $validated['password'],
            'admin',
            'Admin monitoring portal',
            [ActivityLogService::class, 'loginFailureAdminPortal'],
            [ActivityLogService::class, 'loginSuccessAdminPortal'],
        );
    }

    public function residentLogin(Request $request)
    {
        $loginInput = $request->input('username') ?? $request->input('email') ?? $request->input('login');

        if ($loginInput) {
            $validated = $request->validate([
                'password' => ['required', 'string'],
            ]);

            $user = User::with(['gender'])
                ->where('role', 'resident')
                ->where('is_deleted', false)
                ->where(function ($query) use ($loginInput) {
                    $query->where('username', $loginInput)
                        ->orWhere('email', $loginInput);
                })
                ->first();

            if (! $user || ! Hash::check($validated['password'], $user->password)) {
                ActivityLogService::residentPortalFailure(
                    $request,
                    (string) $loginInput,
                    'invalid_username_password',
                );

                return response()->json([
                    'message' => 'The provided credentials are incorrect.',
                ], 401);
            }
        } else {
            $validated = $request->validate([
                'plate_number' => ['required', 'string', 'max:20'],
                'contact_number' => ['required', 'string', 'regex:/^[0-9]{11}$/'],
            ]);

            $normalizedPlate = strtoupper(preg_replace('/\s+/', '', $validated['plate_number']));

            $user = User::with(['gender'])
                ->where('role', 'resident')
                ->where('is_deleted', false)
                ->where('contact_number', $validated['contact_number'])
                ->whereRaw('UPPER(REPLACE(plate_number, " ", "")) = ?', [$normalizedPlate])
                ->first();

            if (! $user) {
                ActivityLogService::residentPortalFailure(
                    $request,
                    $normalizedPlate,
                    'invalid_plate_contact',
                );

                return response()->json([
                    'message' => 'Invalid plate number or contact number.',
                ], 401);
            }
        }

        if (! $user->is_approved) {
            return response()->json([
                'message' => 'Your account is pending approval by the administrator.',
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        ActivityLogService::residentPortalSuccess($request, $user);

        return response()->json([
            'user' => $user,
            'token' => $token,
        ], 200);
    }

    public function forgotPassword(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::where('email', $validated['email'])
            ->where('is_deleted', false)
            ->first();

        if ($user) {
            $newPassword = \Illuminate\Support\Str::random(10);
            $user->password = Hash::make($newPassword);
            $user->save();

            $portalUrl = $user->role === 'admin' 
                ? config('app.admin_url', 'http://localhost:5174')
                : config('app.frontend_url', 'http://localhost:5173');

            \Illuminate\Support\Facades\Mail::to($user->email)->send(
                new \App\Mail\ResidentForgotPasswordMail(
                    $user,
                    $newPassword,
                    $portalUrl
                )
            );
        }

        return response()->json(['message' => 'If an account exists with that email, a new password has been sent.'], 200);
    }

    private function createAdminApprovalNotification(User $user, string $plainPassword)
    {
        $admins = User::where('role', 'admin')
            ->where('is_deleted', false)
            ->get();

        if ($admins->isEmpty()) {
            $fallbackAdmin = User::where('role', 'admin')->first() ?? User::first();
            if ($fallbackAdmin) {
                $admins = collect([$fallbackAdmin]);
            }
        }

        $payload = json_encode([
            'target_user_id' => $user->user_id,
            'username' => $user->username,
            'plain_password' => $plainPassword,
            'email' => $user->email,
            'name' => "{$user->first_name} {$user->last_name}",
            'role' => $user->role,
        ]);

        foreach ($admins as $admin) {
            \App\Models\Notification::create([
                'user_id' => $admin->user_id,
                'title' => 'New Registration Pending Approval',
                'message' => $payload,
                'type' => 'registration_approval',
                'is_read' => false,
            ]);
        }
    }

    private function registerPortalUser(Request $request, string $role)
    {
        $validated = $request->validate([
            'first_name' => ['required', 'max:55'],
            'middle_name' => ['nullable', 'max:55'],
            'last_name' => ['required', 'max:55'],
            'gender' => ['required', 'exists:tbl_genders,gender_id'],
            'birth_date' => ['required', 'date'],
            'email' => ['required', 'email', 'max:255'],
            'username' => ['sometimes', 'min:6', 'max:50', Rule::unique('tbl_users', 'username')],
            'password' => ['sometimes', 'min:6', 'max:50', 'confirmed'],
        ]);

        [$username, $plainPassword] = $this->resolveCredentials($validated);
        $age = date_diff(date_create($validated['birth_date']), date_create('now'))->y;

        $profilePicture = null;
        if ($request->hasFile('profile_picture') || $request->hasFile('avatar')) {
            $file = $request->file('profile_picture') ?? $request->file('avatar');
            $filename = sha1(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME) . '_' . time()) . '.' . ($file->getClientOriginalExtension() ?: 'jpg');
            $file->storeAs('img/user/profile_picture', $filename, 'public');
            $profilePicture = 'img/user/profile_picture/' . $filename;
        }

        $user = User::create([
            'role' => $role,
            'first_name' => $validated['first_name'],
            'middle_name' => $validated['middle_name'] ?? null,
            'last_name' => $validated['last_name'],
            'gender_id' => (int) $validated['gender'],
            'birth_date' => $validated['birth_date'],
            'age' => $age,
            'profile_picture' => $profilePicture,
            'email' => $validated['email'],
            'username' => $username,
            'password' => $plainPassword,
            'is_deleted' => false,
            'is_approved' => ($role === 'admin'),
        ]);

        if ($role !== 'admin') {
            $this->createAdminApprovalNotification($user, $plainPassword);
            return $this->registrationResponse(
                $user,
                $plainPassword,
                'Registration successful. Your account is pending administrator approval.',
            );
        }

        $mailError = $this->sendPortalCredentials($user, $plainPassword);

        return $this->registrationResponse(
            $user,
            $plainPassword,
            $mailError
                ? 'Registration successful, but sending credentials email failed. Check mail_error.'
                : 'Registration successful. Login credentials have been sent to the registered email address.',
            $mailError,
        );
    }

    public function adminRegister(Request $request)
    {
        return $this->registerPortalUser($request, 'admin');
    }

    public function securityGuardRegister(Request $request)
    {
        return $this->registerPortalUser($request, 'security_guard');
    }

    public function residentRegister(Request $request)
    {
        $validated = $request->validate([
            'first_name' => ['required', 'max:55'],
            'middle_name' => ['nullable', 'max:55'],
            'last_name' => ['required', 'max:55'],
            'gender' => ['required', 'exists:tbl_genders,gender_id'],
            'birth_date' => ['required', 'date'],
            'email' => ['required', 'email', 'max:255'],
            'username' => ['sometimes', 'min:6', 'max:50', Rule::unique('tbl_users', 'username')],
            'password' => ['sometimes', 'min:6', 'max:50', 'confirmed'],
            'contact_number' => ['required', 'string', 'regex:/^[0-9]{11}$/'],
            'address' => ['nullable', 'max:255'],
            'plate_number' => ['required', 'max:20', Rule::unique('tbl_users', 'plate_number')],
            'car_model' => ['nullable', 'max:55'],
            'car_color' => ['nullable', 'max:55'],
        ]);

        [$username, $plainPassword] = $this->resolveCredentials($validated);
        $age = date_diff(date_create($validated['birth_date']), date_create('now'))->y;

        $profilePicture = null;
        if ($request->hasFile('profile_picture') || $request->hasFile('avatar')) {
            $file = $request->file('profile_picture') ?? $request->file('avatar');
            $filename = sha1(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME) . '_' . time()) . '.' . ($file->getClientOriginalExtension() ?: 'jpg');
            $file->storeAs('img/user/profile_picture', $filename, 'public');
            $profilePicture = 'img/user/profile_picture/' . $filename;
        }

        $user = User::create([
            'role' => 'resident',
            'first_name' => $validated['first_name'],
            'middle_name' => $validated['middle_name'] ?? null,
            'last_name' => $validated['last_name'],
            'gender_id' => (int) $validated['gender'],
            'birth_date' => $validated['birth_date'],
            'age' => $age,
            'profile_picture' => $profilePicture,
            'email' => $validated['email'],
            'username' => $username,
            'password' => $plainPassword,
            'is_deleted' => false,
            'contact_number' => $validated['contact_number'] ?? null,
            'address' => $validated['address'] ?? null,
            'plate_number' => isset($validated['plate_number'])
                ? strtoupper($validated['plate_number'])
                : null,
            'car_model' => $validated['car_model'] ?? null,
            'car_color' => $validated['car_color'] ?? null,
            'is_approved' => false,
        ]);

        $this->createAdminApprovalNotification($user, $plainPassword);

        return $this->registrationResponse(
            $user,
            $plainPassword,
            'Registration successful. Your account is pending administrator approval.',
        );
    }

    public function smtpTest(Request $request)
    {
        $validated = $request->validate([
            'to' => ['nullable', 'email', 'max:255'],
        ]);

        $recipients = isset($validated['to'])
            ? [$validated['to']]
            : $this->configuredCredentialsRecipients();

        if ($recipients === []) {
            return response()->json([
                'message' => 'SMTP test failed. Configure a valid MAIL_CREDENTIALS_TO or MAIL_USERNAME in .env.',
            ], 422);
        }

        try {
            Mail::raw(
                'SMTP test successful. Your Nextgen Operations backend can send emails via Gmail SMTP.',
                function ($message) use ($recipients) {
                    $message
                        ->to($recipients)
                        ->subject('SMTP Test - Nextgen Operations');
                }
            );

            return response()->json([
                'message' => 'SMTP test email sent successfully.',
                'mail_sent' => true,
                'mail_recipient' => $recipients,
            ], 200);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'SMTP test failed.',
                'mail_sent' => false,
                'mail_recipient' => $recipients,
                'mail_error' => $e->getMessage(),
            ], 500);
        }
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        ActivityLogService::logout($request, $user);
        $user->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged Out Successfully',
        ], 200);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user' => $request->user()->load(['gender']),
        ], 200);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        if ($request->hasFile('profile_picture') || $request->hasFile('avatar')) {
            $file = $request->file('profile_picture') ?? $request->file('avatar');
            $filename = sha1(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME) . '_' . time()) . '.' . ($file->getClientOriginalExtension() ?: 'jpg');
            $file->storeAs('img/user/profile_picture', $filename, 'public');
            $user->profile_picture = 'img/user/profile_picture/' . $filename;
            $user->save();
        } elseif ($request->boolean('remove_profile_picture') || $request->input('remove_profile_picture') == '1') {
            $user->profile_picture = null;
            $user->save();
        }

        if ($user->isAdmin() || $user->isSecurityGuard()) {
            $validated = $request->validate([
                'first_name' => ['sometimes', 'required', 'max:55'],
                'middle_name' => ['nullable', 'max:55'],
                'last_name' => ['sometimes', 'required', 'max:55'],
                'email' => ['sometimes', 'required', 'email', 'max:255'],
                'username' => ['sometimes', 'required', 'min:6', 'max:50', Rule::unique('tbl_users', 'username')->ignore($user->user_id, 'user_id')],
                'contact_number' => ['nullable', 'string', 'regex:/^[0-9]{11}$/'],
                'address' => ['nullable', 'max:255'],
            ]);

            if (! empty($validated)) {
                $user->update($validated);
            }

            return response()->json([
                'message' => 'Profile updated successfully.',
                'user' => $user->fresh()->load('gender'),
            ], 200);
        }

        if (! $user->isResident()) {
            if ($request->hasFile('profile_picture') || $request->hasFile('avatar')) {
                return response()->json([
                    'message' => 'Profile picture updated successfully.',
                    'user' => $user->load('gender'),
                ], 200);
            }

            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'first_name' => ['sometimes', 'required', 'max:55'],
            'middle_name' => ['nullable', 'max:55'],
            'last_name' => ['sometimes', 'required', 'max:55'],
            'gender' => ['sometimes', 'required', 'exists:tbl_genders,gender_id'],
            'birth_date' => ['sometimes', 'required', 'date'],
            'email' => ['sometimes', 'required', 'email', 'max:255'],
            'username' => ['sometimes', 'required', 'min:6', 'max:50', Rule::unique('tbl_users', 'username')->ignore($user->user_id, 'user_id')],
            'contact_number' => ['sometimes', 'required', 'string', 'regex:/^[0-9]{11}$/'],
            'address' => ['sometimes', 'required', 'max:255'],
            'plate_number' => ['sometimes', 'required', 'max:20', Rule::unique('tbl_users', 'plate_number')->ignore($user->user_id, 'user_id')],
            'car_model' => ['sometimes', 'required', 'max:55'],
            'car_color' => ['sometimes', 'required', 'max:55'],
        ]);

        if (isset($validated['birth_date'])) {
            $validated['age'] = date_diff(date_create($validated['birth_date']), date_create('now'))->y;
        }

        if (isset($validated['gender'])) {
            $validated['gender_id'] = $validated['gender'];
            unset($validated['gender']);
        }

        if (isset($validated['plate_number'])) {
            $validated['plate_number'] = strtoupper($validated['plate_number']);
        }

        if (! empty($validated)) {
            $user->update($validated);
        }

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $user->load('gender'),
        ], 200);
    }
}
