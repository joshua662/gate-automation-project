import 'dart:io';
import 'dart:typed_data';

import 'package:crop_your_image/crop_your_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:path_provider/path_provider.dart';

import '../core/constants/app_colors.dart';

class ImageCropperDialog extends StatefulWidget {
  final Uint8List imageBytes;

  const ImageCropperDialog({super.key, required this.imageBytes});

  /// Opens the crop dialog for a given [filePath].
  /// Returns the path to the newly cropped image file, or null if cancelled.
  static Future<String?> show(BuildContext context, String filePath) async {
    final file = File(filePath);
    if (!await file.exists()) return null;

    final bytes = await file.readAsBytes();
    if (!context.mounted) return null;

    return showGeneralDialog<String>(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'Crop Image',
      barrierColor: Colors.black.withAlpha(200),
      transitionDuration: const Duration(milliseconds: 280),
      transitionBuilder: (ctx, animation, _, child) {
        final curve = CurvedAnimation(
          parent: animation,
          curve: const Cubic(0.34, 1.56, 0.64, 1.0),
          reverseCurve: Curves.easeIn,
        );
        return FadeTransition(
          opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.92, end: 1.0).animate(curve),
            child: child,
          ),
        );
      },
      pageBuilder: (ctx, _, __) => ImageCropperDialog(imageBytes: bytes),
    );
  }

  @override
  State<ImageCropperDialog> createState() => _ImageCropperDialogState();
}

class _ImageCropperDialogState extends State<ImageCropperDialog>
    with SingleTickerProviderStateMixin {
  final CropController _cropController = CropController();
  bool _isCropping = false;
  late AnimationController _closeCtrl;

  @override
  void initState() {
    super.initState();
    _closeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
      value: 1.0,
    );
  }

  @override
  void dispose() {
    _closeCtrl.dispose();
    super.dispose();
  }

  Future<void> _close([String? result]) async {
    await _closeCtrl.reverse();
    if (mounted) Navigator.of(context).pop(result);
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _closeCtrl,
      child: Dialog(
        backgroundColor: const Color(0xFF0A0E27),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
        child: Container(
          width: 480.w,
          height: 520.h,
          padding: EdgeInsets.all(16.r),
          child: Column(
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Crop Profile Picture',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16.sp,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white70),
                    onPressed: () => _close(null),
                  ),
                ],
              ),
              SizedBox(height: 10.h),

              // Cropping canvas
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12.r),
                  child: Crop(
                    image: widget.imageBytes,
                    controller: _cropController,
                    onCropped: (cropResult) async {
                      final nav = Navigator.of(context);
                      try {
                        Uint8List? croppedData;
                        final dynamic res = cropResult;
                        if (res is CropSuccess) {
                          croppedData = res.croppedImage;
                        } else if (res is Uint8List) {
                          croppedData = res;
                        } else {
                          try {
                            croppedData = (res as dynamic).croppedImage as Uint8List?;
                          } catch (_) {}
                        }

                        if (croppedData == null || croppedData.isEmpty) {
                          throw Exception('Crop returned empty image');
                        }

                        final tempDir = await getTemporaryDirectory();
                        final outputFile = File(
                          '${tempDir.path}/cropped_${DateTime.now().millisecondsSinceEpoch}.jpg',
                        );
                        await outputFile.writeAsBytes(croppedData);

                        if (mounted) {
                          nav.pop(outputFile.path);
                        }
                      } catch (e) {
                        if (mounted) {
                          setState(() => _isCropping = false);
                        }
                      }
                    },
                    aspectRatio: 1.0,
                    withCircleUi: true,
                  ),
                ),
              ),
              SizedBox(height: 16.h),

              // Actions
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: BorderSide(color: Colors.white.withAlpha(80)),
                        padding: EdgeInsets.symmetric(vertical: 12.h),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10.r),
                        ),
                      ),
                      onPressed: () => _close(null),
                      child: const Text('Cancel'),
                    ),
                  ),
                  SizedBox(width: 12.w),
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: EdgeInsets.symmetric(vertical: 12.h),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10.r),
                        ),
                      ),
                      onPressed: _isCropping
                          ? null
                          : () {
                              setState(() => _isCropping = true);
                              _cropController.crop();
                            },
                      child: _isCropping
                          ? SizedBox(
                              width: 18.r,
                              height: 18.r,
                              child: const CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : const Text('Crop & Apply'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
