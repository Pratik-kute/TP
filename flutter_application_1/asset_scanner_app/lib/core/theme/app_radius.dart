import 'package:flutter/widgets.dart';

/// Corner radius tokens.
class AppRadius {
  AppRadius._();

  static const double r4 = 4;
  static const double r8 = 8;
  static const double r12 = 12;
  static const double r14 = 14;
  static const double r16 = 16;
  static const double r999 = 999; // pill

  static const Radius radius8 = Radius.circular(r8);
  static const Radius radius12 = Radius.circular(r12);
  static const Radius radius14 = Radius.circular(r14);
  static const Radius radius16 = Radius.circular(r16);

  static const BorderRadius all8 = BorderRadius.all(radius8);
  static const BorderRadius all12 = BorderRadius.all(radius12);
  static const BorderRadius all14 = BorderRadius.all(radius14);
  static const BorderRadius all16 = BorderRadius.all(radius16);
  static const BorderRadius pill = BorderRadius.all(Radius.circular(r999));
}
