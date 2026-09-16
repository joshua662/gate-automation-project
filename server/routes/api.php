<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\GateController;
use App\Http\Controllers\Api\GateLogController;
use App\Http\Controllers\Api\GenderController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ResidentController;
use App\Http\Controllers\Api\UpdateRequestController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::controller(AuthController::class)->prefix('/auth')->group(function () {
    Route::post('/login', 'login');
    Route::post('/admin/login', 'adminLogin');
    Route::post('/admin/register', 'adminRegister');
    Route::post('/security-guard/register', 'securityGuardRegister');
    Route::post('/resident/login', 'residentLogin');
    Route::post('/resident/register', 'residentRegister');
    Route::post('/forgot-password', 'forgotPassword');
    Route::post('/smtp-test', 'smtpTest');
});

Route::get('/gender/publicGenders', [GenderController::class, 'loadGenders']);
Route::get('/gender/loadGenders', [GenderController::class, 'loadGenders']);

Route::post('/gate/verify', [GateController::class, 'verify']);
Route::get('/gate/camera-stream-proxy', [GateController::class, 'cameraStreamProxy']);

Route::middleware('auth:sanctum')->group(function () {
    Route::controller(AuthController::class)->prefix('/auth')->group(function () {
        Route::get('/me', 'me');
        Route::post('/logout', 'logout');
        Route::match(['put', 'post'], '/profile', 'updateProfile')->middleware('role:admin,resident,security_guard');
    });

    Route::controller(GenderController::class)->prefix('/gender')->group(function () {
        Route::get('/getGender/{genderID}', 'getGender');
        Route::post('/storeGender', 'storeGender');
        Route::put('/updateGender/{gender}', 'updateGender');
        Route::put('/destroyGender/{gender}', 'destroyGender');
    });

    Route::middleware('role:admin,security_guard')->group(function () {
        Route::controller(UserController::class)->prefix('/user')->group(function () {
            Route::get('/loadUsers', 'loadUsers');
            Route::get('/memberCardQr/{user}', 'memberCardQr')->middleware('role:admin');
            Route::post('/storeUser', 'storeUser');
            Route::put('/updateUser/{user}', 'updateUser');
            Route::delete('/destroyUser/{user}', 'destroyUser');
        });

        Route::controller(ResidentController::class)->prefix('/resident')->group(function () {
            Route::get('/loadResidents', 'loadResidents');
            Route::post('/storeResident', 'storeResident');
            Route::put('/updateResident/{resident}', 'updateResident');
            Route::put('/updateRfid/{resident}', 'updateRfid');
            Route::delete('/destroyResident/{resident}', 'destroyResident');
        });

        Route::controller(DashboardController::class)->prefix('/dashboard')->group(function () {
            Route::get('/overview', 'overview');
            Route::get('/traffic-chart', 'trafficChart');
        });

        Route::controller(GateController::class)->prefix('/gate')->group(function () {
            Route::get('/status', 'status');
            Route::get('/camera-snapshot', 'cameraSnapshot');
            Route::get('/check-plate', 'checkPlate');
            Route::put('/toggle', 'toggleGate');
            Route::put('/system-health', 'updateSystemHealth');
            Route::post('/test-connection', 'testConnection');
        });

        Route::controller(GateLogController::class)->prefix('/gate-log')->group(function () {
            Route::get('/loadGateLogs', 'loadGateLogs');
        });

        Route::get('/activity-log/loadActivityLogs', [ActivityLogController::class, 'loadActivityLogs']);

        Route::controller(UpdateRequestController::class)->prefix('/update-request')->group(function () {
            Route::get('/loadRequests', 'loadRequests');
            Route::put('/review/{updateRequest}', 'reviewRequest');
        });
    });

    Route::middleware('role:resident,security_guard,admin')->group(function () {
        Route::controller(GateLogController::class)->prefix('/gate-log')->group(function () {
            Route::get('/my-logs', 'loadGateLogs');
            Route::get('/export/csv', 'exportCsv');
            Route::get('/export/pdf', 'exportPdf');
        });

        Route::controller(UpdateRequestController::class)->prefix('/update-request')->group(function () {
            Route::get('/my-requests', 'loadRequests');
            Route::post('/submit', 'storeRequest');
        });

        Route::get('/gate/status', [GateController::class, 'status']);
    });

    Route::controller(NotificationController::class)->prefix('/notification')->group(function () {
        Route::get('/', 'index');
        Route::put('/{notification}/read', 'markRead');
        Route::put('/read-all', 'markAllRead');
        Route::delete('/{notification}', 'destroy');
        Route::post('/{notification}/approve', 'approve');
        Route::post('/{notification}/reject', 'reject');
    });
});
