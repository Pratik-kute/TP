import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

class HintText extends StatelessWidget {
  const HintText(this.text, {this.align, super.key});
  final String text;
  final TextAlign? align;

  @override
  Widget build(BuildContext context) {
    return Text(text, style: AppTypography.bodyMuted, textAlign: align);
  }
}

class HintPill extends StatelessWidget {
  const HintPill(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s12,
        vertical: AppSpacing.s8,
      ),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.5),
        borderRadius: AppRadius.pill,
      ),
      child: Text(
        text,
        style: AppTypography.caption.copyWith(color: AppColors.textInverse),
      ),
    );
  }
}

class InlineTip extends StatelessWidget {
  const InlineTip(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s12),
      decoration: const BoxDecoration(
        color: AppColors.infoBg,
        borderRadius: AppRadius.all8,
      ),
      child: Row(
        children: <Widget>[
          const Icon(Icons.info_outline, size: 18, color: AppColors.info),
          const SizedBox(width: AppSpacing.s8),
          Expanded(
            child: Text(
              text,
              style: AppTypography.caption.copyWith(color: AppColors.info),
            ),
          ),
        ],
      ),
    );
  }
}

/// Tappable stat chip: "Open repairs: 1" / "Overdue: 2".
class StatChip extends StatelessWidget {
  const StatChip({
    required this.label,
    required this.count,
    required this.onTap,
    this.tone = StatChipTone.warning,
    super.key,
  });

  final String label;
  final int count;
  final VoidCallback onTap;
  final StatChipTone tone;

  @override
  Widget build(BuildContext context) {
    final palette = _palette(tone);
    return Material(
      color: palette.bg,
      shape: const RoundedRectangleBorder(borderRadius: AppRadius.all8),
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.all8,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.s12,
            vertical: AppSpacing.s8,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(
                '$count',
                style: AppTypography.subheading.copyWith(color: palette.fg),
              ),
              const SizedBox(width: AppSpacing.s8),
              Text(
                label,
                style: AppTypography.caption.copyWith(color: palette.fg),
              ),
              const SizedBox(width: 4),
              Icon(Icons.chevron_right, size: 16, color: palette.fg),
            ],
          ),
        ),
      ),
    );
  }

  ({Color bg, Color fg}) _palette(StatChipTone tone) {
    switch (tone) {
      case StatChipTone.warning:
        return (bg: AppColors.warningBg, fg: AppColors.warning);
      case StatChipTone.danger:
        return (bg: AppColors.dangerBg, fg: AppColors.danger);
      case StatChipTone.info:
        return (bg: AppColors.infoBg, fg: AppColors.info);
    }
  }
}

enum StatChipTone { warning, danger, info }

/// Identity header used on Asset Details. Title (asset name) + asset code +
/// category/status row.
class IdentityHeader extends StatelessWidget {
  const IdentityHeader({
    required this.title,
    required this.code,
    required this.belowCode,
    this.onCopyCode,
    super.key,
  });

  final String title;
  final String code;
  final Widget belowCode;
  final VoidCallback? onCopyCode;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.s16),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            title,
            style: AppTypography.heading,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.s4),
          GestureDetector(
            onLongPress: onCopyCode,
            child: Text(code, style: AppTypography.monoBody),
          ),
          const SizedBox(height: AppSpacing.s8),
          belowCode,
        ],
      ),
    );
  }
}
