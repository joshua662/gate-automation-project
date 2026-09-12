<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ResidentGateAccessWelcomeMail;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class ResidentController extends Controller
{
    public function loadResidents(Request $request)
    {
        $search = $request->input('search');

        $residents = User::with(['gender'])
            ->where('role', 'resident')
            ->where('is_deleted', false)
            ->orderBy('last_name')
            ->orderBy('first_name');

        if ($search) {
            $residents->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('middle_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('plate_number', 'like', "%{$search}%")
                    ->orWhere('contact_number', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $paginated = $residents->paginate(15);

        return response()->json(['residents' => $paginated], 200);
    }

    public function storeResident(Request $request)
    {
        $validated = $this->validateResident($request);
        $plainPassword = $validated['password'];

        $age = date_diff(date_create($validated['birth_date']), date_create('now'))->y;

        $user = User::create([
            'role' => 'resident',
            'first_name' => $validated['first_name'],
            'middle_name' => $validated['middle_name'] ?? null,
            'last_name' => $validated['last_name'],
            'gender_id' => $validated['gender'],
            'birth_date' => $validated['birth_date'],
            'age' => $age,
            'email' => $validated['email'],
            'username' => $validated['username'],
            'password' => $plainPassword,
            'contact_number' => $validated['contact_number'],
            'address' => $validated['address'],
            'plate_number' => strtoupper($validated['plate_number']),
            'car_model' => $validated['car_model'],
            'car_color' => $validated['car_color'],
        ]);

        $user->load('gender');

        $mailError = null;

        $credentialsMailbox = trim((string) $user->email);

        if (! filter_var($credentialsMailbox, FILTER_VALIDATE_EMAIL)) {
            $mailError = 'The registered resident does not have a valid email address.';
        } else {
            try {
                \Illuminate\Support\Facades\Log::info("Sending credentials email to: " . $credentialsMailbox);
                Mail::to($credentialsMailbox)->send(new ResidentGateAccessWelcomeMail(
                    $user,
                    $plainPassword,
                    config('gate.portal_url'),
                ));
            } catch (\Throwable $e) {
                report($e);
                $mailError = $e->getMessage();
            }
        }

        return response()->json([
            'message' => $mailError
                ? 'Resident saved, but credentials email failed. Check mail_error.'
                : 'Resident successfully saved. Credentials email sent to the resident email address.',
            'mail_sent' => $mailError === null,
            'mail_error' => $mailError,
            'mail_recipient' => $credentialsMailbox,
        ], 200);
    }

    public function updateResident(Request $request, User $resident)
    {
        if ($resident->role !== 'resident' || $resident->is_deleted) {
            return response()->json(['message' => 'Resident not found.'], 404);
        }

        $validated = $this->validateResident($request, $resident->user_id);
        $age = date_diff(date_create($validated['birth_date']), date_create('now'))->y;

        $update = [
            'first_name' => $validated['first_name'],
            'middle_name' => $validated['middle_name'] ?? null,
            'last_name' => $validated['last_name'],
            'gender_id' => $validated['gender'],
            'birth_date' => $validated['birth_date'],
            'age' => $age,
            'email' => $validated['email'],
            'username' => $validated['username'],
            'contact_number' => $validated['contact_number'],
            'address' => $validated['address'],
            'plate_number' => strtoupper($validated['plate_number']),
            'car_model' => $validated['car_model'],
            'car_color' => $validated['car_color'],
        ];

        if ($request->filled('password')) {
            $update['password'] = $validated['password'];
        }

        $resident->update($update);

        return response()->json([
            'message' => 'Resident successfully updated.',
            'resident' => $resident->load('gender'),
        ], 200);
    }

    public function destroyResident(User $resident)
    {
        if ($resident->role !== 'resident') {
            return response()->json(['message' => 'Resident not found.'], 404);
        }

        $resident->update(['is_deleted' => true]);

        return response()->json(['message' => 'Resident successfully deleted.'], 200);
    }

    public function updateRfid(Request $request, User $resident)
    {
        if ($resident->role !== 'resident' || $resident->is_deleted) {
            return response()->json(['message' => 'Resident not found.'], 404);
        }

        if (!empty($resident->rfid_card_uid)) {
            return response()->json([
                'message' => 'RFID UID has already been assigned and cannot be changed.',
            ], 403);
        }

        $validated = $request->validate([
            'rfid_card_uid' => [
                'required',
                'string',
                'max:50',
                Rule::unique('tbl_users', 'rfid_card_uid')->ignore($resident->user_id, 'user_id'),
            ],
        ]);

        $normalizedRfid = strtoupper(preg_replace('/[^A-F0-9]/', '', $validated['rfid_card_uid']));

        $resident->update([
            'rfid_card_uid' => $normalizedRfid,
        ]);

        return response()->json([
            'message' => 'RFID UID successfully assigned.',
            'resident' => $resident->load('gender'),
        ], 200);
    }

    private function validateResident(Request $request, ?int $ignoreUserId = null): array
    {
        return $request->validate([
            'first_name' => ['required', 'max:55'],
            'middle_name' => ['nullable', 'max:55'],
            'last_name' => ['required', 'max:55'],
            'gender' => ['required', 'exists:tbl_genders,gender_id'],
            'birth_date' => ['required', 'date'],
            'email' => ['required', 'email', 'max:255'],
            'username' => ['required', 'min:6', 'max:50', Rule::unique('tbl_users', 'username')->ignore($ignoreUserId, 'user_id')],
            'password' => $ignoreUserId === null
                ? ['required', 'string', 'min:6', 'max:50', 'confirmed']
                : ['sometimes', 'nullable', 'string', 'min:6', 'max:50', 'confirmed'],
            'contact_number' => ['required', 'string', 'regex:/^[0-9]{11}$/'],
            'address' => ['required', 'max:255'],
            'plate_number' => ['required', 'max:20', Rule::unique('tbl_users', 'plate_number')->ignore($ignoreUserId, 'user_id')],
            'car_model' => ['required', 'max:55'],
            'car_color' => ['required', 'max:55'],
        ]);
    }
}
