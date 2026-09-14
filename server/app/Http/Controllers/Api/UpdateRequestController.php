<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\UpdateRequest;
use App\Models\User;
use App\Services\GateService;
use Illuminate\Http\Request;

class UpdateRequestController extends Controller
{
    public function loadRequests(Request $request)
    {
        $query = UpdateRequest::with(['resident.gender'])
            ->orderByDesc('created_at');

        if ($request->user()->isResident()) {
            $query->where('user_id', $request->user()->user_id);
        } elseif ($request->status) {
            $query->where('status', $request->status);
        }

        return response()->json(['requests' => $query->paginate(15)], 200);
    }

    public function storeRequest(Request $request)
    {
        $requestType = $request->input('request_type', 'profile_update');

        if ($requestType === 'guest_access') {
            $validated = $request->validate([
                'request_type' => ['required', 'in:guest_access'],
                'guest_name' => ['required', 'max:155'],
                'guest_age' => ['nullable', 'integer', 'min:1', 'max:150'],
                'guest_contact_number' => ['nullable', 'string', 'regex:/^[0-9+\s-]{7,20}$/'],
                'guest_address' => ['nullable', 'max:255'],
                'guest_plate_number' => ['nullable', 'max:20'],
                'guest_car_model' => ['nullable', 'max:55'],
                'guest_car_color' => ['nullable', 'max:55'],
                'access_date' => ['nullable', 'date'],
                'access_reason' => ['required', 'max:500'],
            ]);

            if (empty($validated['access_date'])) {
                $validated['access_date'] = now()->toDateString();
            }

            if (! empty($validated['guest_plate_number'])) {
                $validated['guest_plate_number'] = strtoupper($validated['guest_plate_number']);
            }
            $changes = array_filter($validated, fn ($v) => $v !== null && $v !== '');
        } else {
            $validated = $request->validate([
                'first_name' => ['nullable', 'max:55'],
                'middle_name' => ['nullable', 'max:55'],
                'last_name' => ['nullable', 'max:55'],
                'gender' => ['nullable', 'exists:tbl_genders,gender_id'],
                'birth_date' => ['nullable', 'date'],
                'contact_number' => ['nullable', 'string', 'regex:/^[0-9]{11}$/'],
                'address' => ['nullable', 'max:255'],
                'plate_number' => ['nullable', 'max:20'],
                'car_model' => ['nullable', 'max:55'],
                'car_color' => ['nullable', 'max:55'],
            ]);

            $changes = array_filter($validated, fn ($v) => $v !== null && $v !== '');
        }

        if (empty($changes)) {
            return response()->json(['message' => 'No changes submitted.'], 422);
        }

        $updateRequest = UpdateRequest::create([
            'user_id' => $request->user()->user_id,
            'requested_changes' => $changes,
            'status' => 'pending',
        ]);

        if ($requestType === 'guest_access') {
            $guestPlate = ! empty($changes['guest_plate_number']) ? ' (' . $changes['guest_plate_number'] . ')' : '';
            GateService::notifySecurityGuards(
                'Guest Access Pass Requested',
                $request->user()->owner_name . ' requested a guest access pass for ' . ($changes['guest_name'] ?? 'Visitor') . $guestPlate . '. [REQUEST_ID:' . $updateRequest->update_request_id . ']',
                'guest_access'
            );
        } else {
            GateService::notifyAdmins(
                'Profile Update Request',
                $request->user()->owner_name . ' submitted a profile update request. [REQUEST_ID:' . $updateRequest->update_request_id . ']',
                'update_request'
            );
        }

        return response()->json([
            'message' => $requestType === 'guest_access'
                ? 'Guest access request submitted for admin review.'
                : 'Update request submitted for admin review.',
            'request' => $updateRequest,
        ], 200);
    }

    public function reviewRequest(Request $request, UpdateRequest $updateRequest)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:approved,rejected'],
            'admin_notes' => ['nullable', 'string', 'max:500'],
        ]);

        if ($updateRequest->status !== 'pending') {
            return response()->json(['message' => 'Request already reviewed.'], 422);
        }

        $updateRequest->update([
            'status' => $validated['status'],
            'admin_notes' => $validated['admin_notes'] ?? null,
        ]);

        $resident = User::find($updateRequest->user_id);

        if ($validated['status'] === 'approved' && $resident && (($updateRequest->requested_changes['request_type'] ?? 'profile_update') !== 'guest_access')) {
            $changes = $updateRequest->requested_changes;

            if (isset($changes['plate_number'])) {
                $changes['plate_number'] = strtoupper($changes['plate_number']);
            }

            if (isset($changes['birth_date'])) {
                $changes['age'] = date_diff(date_create($changes['birth_date']), date_create('now'))->y;
            }

            if (isset($changes['gender'])) {
                $changes['gender_id'] = $changes['gender'];
                unset($changes['gender']);
            }

            $resident->update($changes);
        }

        Notification::create([
            'user_id' => $updateRequest->user_id,
            'title' => (($updateRequest->requested_changes['request_type'] ?? 'profile_update') === 'guest_access' ? 'Guest Access ' : 'Update Request ') . ucfirst($validated['status']),
            'message' => $validated['status'] === 'approved'
                ? ((($updateRequest->requested_changes['request_type'] ?? 'profile_update') === 'guest_access')
                    ? 'Your guest access request has been approved.'
                    : 'Your profile update has been approved and applied.')
                : ((($updateRequest->requested_changes['request_type'] ?? 'profile_update') === 'guest_access')
                    ? 'Your guest access request was rejected.'
                    : 'Your profile update request was rejected.') . ($validated['admin_notes'] ? ' Note: ' . $validated['admin_notes'] : ''),
            'type' => 'update_request',
        ]);

        return response()->json([
            'message' => 'Update request reviewed.',
            'request' => $updateRequest->load('resident'),
        ], 200);
    }
}
