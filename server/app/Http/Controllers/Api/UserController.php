<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;
use chillerlan\QRCode\Output\QROutputInterface;

class UserController extends Controller
{
    public function loadUsers(Request $request)
    {
        $search = $request->input('search');

        $users = User::with(['gender'])
            ->leftJoin('tbl_genders', 'tbl_users.gender_id', '=', 'tbl_genders.gender_id')
            ->where('tbl_users.is_deleted', false)
            ->orderBy('tbl_users.last_name', 'asc')
            ->orderBy('tbl_users.first_name', 'asc')
            ->orderBy('tbl_users.middle_name', 'asc')
            ->orderBy('tbl_users.suffix_name', 'asc');

        if ($search) {
            $users->where(function ($user) use ($search) {
                $user->where('tbl_users.first_name', 'like', "%{$search}%")
                    ->orWhere('tbl_users.middle_name', 'like', "%{$search}%")
                    ->orWhere('tbl_users.last_name', 'like', "%{$search}%")
                    ->orWhere('tbl_users.suffix_name', 'like', "%{$search}%")
                    ->orWhere('tbl_genders.gender', 'like', "%{$search}%");
            });
        }

        $users = $users->paginate(15);

        $users->getCollection()->transform(function ($user) {
            $user->profile_picture = $user->profile_picture ? url('storage/public/img/user/profile_picture/' . $user->profile_picture) : null;

            return $user;
        });

        return response()->json([
            'users' => $users
        ], 200);
    }

    public function storeUser(Request $request)
    {
        $validated = $request->validate([
            'add_user_profile_picture' => ['nullable', 'image', 'mimes:png,jpg,jpeg'],
            'first_name' => ['required', 'max:55'],
            'middle_name' => ['nullable', 'max:55'],
            'last_name' => ['required', 'max:55'],
            'suffix_name' => ['nullable', 'max:55'],
            'gender' => ['required'],
            'birth_date' => ['required', 'date'],
            'username' => ['required', 'min:6', 'max:12', Rule::unique('tbl_users', 'username')],
            'password' => ['required', 'min:6', 'max:12', 'confirmed'],
            'password_confirmation' => ['required', 'min:6', 'max:12']
        ]);

        if ($request->hasFile('add_user_profile_picture')) {
            $filenameWithExtension = $request->file('add_user_profile_picture');
            $filename = pathinfo($filenameWithExtension->getClientOriginalName(), PATHINFO_FILENAME);
            $extension = $filenameWithExtension->getClientOriginalExtension();
            $filenameToStore = sha1($filename . '_' . time()) . '.' . ($extension ?: 'jpg');
            $filenameWithExtension->storeAs('img/user/profile_picture', $filenameToStore, 'public');
            $validated['add_user_profile_picture'] = 'img/user/profile_picture/' . $filenameToStore;
        }

        $age = date_diff(date_create($validated['birth_date']), date_create('now'))->y;

        User::create([
            'profile_picture' => $validated['add_user_profile_picture'],
            'first_name' => $validated['first_name'],
            'middle_name' => $validated['middle_name'],
            'last_name' => $validated['last_name'],
            'suffix_name' => $validated['suffix_name'],
            'gender_id' => $validated['gender'],
            'birth_date' => $validated['birth_date'],
            'age' => $age,
            'username' => $validated['username'],
            'password' => $validated['password']
        ]);

        return response()->json([
            'message' => 'User Successfully Saved.'
        ], 200);
    }

    public function updateUser(Request $request, User $user)
    {
        $validated = $request->validate([
            'edit_user_profile_picture' => ['nullable', 'image', 'mimes:png,jpg,jpeg'],
            'first_name' => ['required', 'max:55'],
            'middle_name' => ['nullable', 'max:55'],
            'last_name' => ['required', 'max:55'],
            'suffix_name' => ['nullable', 'max:55'],
            'gender' => ['required'],
            'birth_date' => ['required', 'date'],
            'email' => ['nullable', 'email', 'max:255'],
            'contact_number' => ['nullable', 'string', 'regex:/^[0-9]{11}$/'],
            'username' => ['required', 'min:6', 'max:50', Rule::unique('tbl_users', 'username')->ignore($user->user_id, 'user_id')]
        ]);

        if ($request->has('remove_profile_picture') && $request->remove_profile_picture == '1') {
            if ($user->profile_picture && Storage::exists('public/img/user/profile_picture/' . $user->profile_picture)) {
                Storage::delete('public/img/user/profile_picture/' . $user->profile_picture);
                $user->profile_picture = null;
            }
        } else if ($request->hasFile('edit_user_profile_picture')) {
            $filenameWithExtension = $request->file('edit_user_profile_picture');
            $filename = pathinfo($filenameWithExtension->getClientOriginalName(), PATHINFO_FILENAME);
            $extension = $filenameWithExtension->getClientOriginalExtension();
            $filenameToStore = sha1($filename . '_' . time()) . '.' . ($extension ?: 'jpg');
            $filenameWithExtension->storeAs('img/user/profile_picture', $filenameToStore, 'public');
            $validated['edit_user_profile_picture'] = 'img/user/profile_picture/' . $filenameToStore;
        }

        $age = date_diff(date_create($validated['birth_date']), date_create('now'))->y;

        $user->update([
            'profile_picture' => $validated['edit_user_profile_picture'] ?? $user->profile_picture,
            'first_name' => $validated['first_name'],
            'middle_name' => $validated['middle_name'],
            'last_name' => $validated['last_name'],
            'suffix_name' => $validated['suffix_name'],
            'gender_id' => $validated['gender'],
            'birth_date' => $validated['birth_date'],
            'age' => $age,
            'email' => $validated['email'] ?? $user->email,
            'contact_number' => $validated['contact_number'] ?? $user->contact_number,
            'username' => $validated['username']
        ]);

        $user->profile_picture = $user->profile_picture ? url('storage/public/img/user/profile_picture/' . $user->profile_picture) : null;

        return response()->json([
            'message' => 'User Successfully Updated.',
            'user' => $user
        ], 200);
    }

    public function destroyUser(User $user)
    {
        $user->update([
            'is_deleted' => true
        ]);

        return response()->json([
            'message' => 'User Successfully Deleted.'
        ], 200);
    }

    public function memberCardQr(User $user)
    {
        if (! in_array($user->role, ['security_guard', 'resident'], true) || $user->is_deleted) {
            return response()->json(['message' => 'Member card user not found.'], 404);
        }

        $payload = [
            'uid' => $user->user_id,
            'role' => $user->role,
            'name' => trim("{$user->first_name} {$user->middle_name} {$user->last_name}"),
            'email' => $user->email ?? '',
            'phone' => $user->contact_number ?? '',
            'plate' => $user->role === 'resident' ? ($user->plate_number ?? '') : '',
        ];

        try {
            $options = new QROptions([
                'outputType' => QROutputInterface::GDIMAGE_PNG,
                'scale' => 10,
                'outputBase64' => true,
            ]);

            $qrcode = (new QRCode($options))->render(
                json_encode($payload, JSON_UNESCAPED_SLASHES)
            );

            return response()->json([
                'qr_code' => $qrcode,
            ], 200);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Unable to generate member card QR code.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
