import 'package:flutter/services.dart';

class PlateInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final String clean = newValue.text.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
    
    if (clean.isEmpty) {
      return newValue.copyWith(
        text: '',
        selection: const TextSelection.collapsed(offset: 0),
      );
    }
    
    String formatted = '';
    final match = RegExp(r'^([A-Z]+)(\d*)$').firstMatch(clean);
    
    if (match != null) {
      final letters = match.group(1)!;
      final digits = match.group(2)!;
      if (digits.isNotEmpty) {
        final cutDigits = digits.length > 4 ? digits.substring(0, 4) : digits;
        formatted = '$letters $cutDigits';
      } else {
        formatted = letters.length > 4 ? letters.substring(0, 4) : letters;
      }
    } else {
      if (clean.length > 3) {
        final p1 = clean.substring(0, 3);
        final p2 = clean.length > 7 ? clean.substring(3, 7) : clean.substring(3);
        formatted = '$p1 $p2';
      } else {
        formatted = clean;
      }
    }

    // Keep the cursor at the end to avoid complexity of computing exact cursor pos 
    // after formatting spaces. For short inputs, this is acceptable.
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}
