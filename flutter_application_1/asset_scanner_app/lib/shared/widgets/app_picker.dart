import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

/// Sheet-based single-select picker.
///
/// The label area renders a "field-like" tappable surface; the actual
/// selection happens in a bottom sheet with a searchable list.
class AppPicker<T> extends StatelessWidget {
  const AppPicker({
    required this.label,
    required this.options,
    required this.value,
    required this.onChanged,
    required this.itemLabel,
    this.placeholder = 'Select…',
    this.errorText,
    this.enabled = true,
    this.searchable = true,
    this.emptyLabel,
    super.key,
  });

  final String label;
  final List<T> options;
  final T? value;
  final ValueChanged<T> onChanged;
  final String Function(T) itemLabel;
  final String placeholder;
  final String? errorText;
  final bool enabled;
  final bool searchable;
  final String? emptyLabel;

  @override
  Widget build(BuildContext context) {
    final hasValue = value != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: AppTypography.captionStrong),
        const SizedBox(height: 6),
        InkWell(
          onTap: enabled ? () => _open(context) : null,
          borderRadius: AppRadius.all8,
          child: Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: AppRadius.all8,
              border: Border.all(
                color: errorText != null ? AppColors.danger : AppColors.border,
              ),
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    hasValue ? itemLabel(value as T) : placeholder,
                    style: AppTypography.body.copyWith(
                      color: hasValue
                          ? AppColors.textPrimary
                          : AppColors.textMuted,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const Icon(
                  Icons.keyboard_arrow_down,
                  color: AppColors.textSecondary,
                ),
              ],
            ),
          ),
        ),
        if (errorText != null) ...<Widget>[
          const SizedBox(height: 4),
          Text(
            errorText!,
            style: AppTypography.caption.copyWith(color: AppColors.danger),
          ),
        ],
      ],
    );
  }

  Future<void> _open(BuildContext context) async {
    if (options.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(emptyLabel ?? 'No options available')),
      );
      return;
    }
    final selected = await showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PickerSheet<T>(
        title: label,
        options: options,
        itemLabel: itemLabel,
        searchable: searchable,
        value: value,
      ),
    );
    if (selected != null) onChanged(selected);
  }
}

class _PickerSheet<T> extends StatefulWidget {
  const _PickerSheet({
    required this.title,
    required this.options,
    required this.itemLabel,
    required this.searchable,
    required this.value,
  });

  final String title;
  final List<T> options;
  final String Function(T) itemLabel;
  final bool searchable;
  final T? value;

  @override
  State<_PickerSheet<T>> createState() => _PickerSheetState<T>();
}

class _PickerSheetState<T> extends State<_PickerSheet<T>> {
  late List<T> _filtered;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _filtered = widget.options;
  }

  void _onQueryChanged(String q) {
    setState(() {
      _query = q;
      final lower = q.toLowerCase();
      _filtered = widget.options
          .where((o) => widget.itemLabel(o).toLowerCase().contains(lower))
          .toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.viewInsetsOf(context);
    return Padding(
      padding: EdgeInsets.only(bottom: viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.7,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const SizedBox(height: AppSpacing.s12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: AppSpacing.s12),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.s16,
                ),
                child: Text(widget.title, style: AppTypography.subheading),
              ),
              const SizedBox(height: AppSpacing.s12),
              if (widget.searchable)
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.s16,
                  ),
                  child: TextField(
                    onChanged: _onQueryChanged,
                    decoration: const InputDecoration(
                      hintText: 'Search…',
                      prefixIcon: Icon(Icons.search, size: 20),
                    ),
                  ),
                ),
              const SizedBox(height: AppSpacing.s8),
              Flexible(
                child: _filtered.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.all(AppSpacing.s24),
                        child: Text(
                          _query.isEmpty
                              ? 'No options'
                              : 'No matches for "$_query"',
                          style: AppTypography.bodyMuted,
                          textAlign: TextAlign.center,
                        ),
                      )
                    : ListView.separated(
                        shrinkWrap: true,
                        itemCount: _filtered.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (_, i) {
                          final option = _filtered[i];
                          final isSelected = option == widget.value;
                          return ListTile(
                            title: Text(
                              widget.itemLabel(option),
                              style: AppTypography.body,
                            ),
                            trailing: isSelected
                                ? const Icon(
                                    Icons.check,
                                    color: AppColors.brand,
                                  )
                                : null,
                            onTap: () => Navigator.of(context).pop(option),
                          );
                        },
                      ),
              ),
              const SizedBox(height: AppSpacing.s8),
            ],
          ),
        ),
      ),
    );
  }
}
