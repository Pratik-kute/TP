/// Formats a [DateTime] as a short, human relative phrase ("2 days ago",
/// "in 3 days", "Just now"). Anchored to [now] so callers can pass a
/// fixed clock in tests.
String formatRelative(DateTime time, {DateTime? now}) {
  final reference = now ?? DateTime.now();
  final diff = time.difference(reference);
  final isFuture = !diff.isNegative;
  final absolute = diff.abs();

  String suffix(String unit, int n) {
    final plural = n == 1 ? '' : 's';
    return isFuture ? 'in $n $unit$plural' : '$n $unit$plural ago';
  }

  if (absolute.inSeconds < 45) return 'Just now';
  if (absolute.inMinutes < 60) return suffix('minute', absolute.inMinutes);
  if (absolute.inHours < 24) return suffix('hour', absolute.inHours);
  if (absolute.inDays < 30) return suffix('day', absolute.inDays);
  if (absolute.inDays < 365) {
    return suffix('month', (absolute.inDays / 30).round());
  }
  return suffix('year', (absolute.inDays / 365).round());
}

/// Formats a [DateTime] as the section-header label for a date-grouped list
/// (Activity Log, future event timelines). Returns "TODAY", "YESTERDAY", or
/// the full date in upper-case ("28 APR 2026"). Anchored to [now] so callers
/// can pass a fixed clock in tests.
String formatDateGroupHeader(DateTime time, {DateTime? now}) {
  final reference = now ?? DateTime.now();
  final today = DateTime(reference.year, reference.month, reference.day);
  final yesterday = today.subtract(const Duration(days: 1));
  final stamp = DateTime(time.year, time.month, time.day);

  if (stamp == today) return 'TODAY';
  if (stamp == yesterday) return 'YESTERDAY';

  const months = <String>[
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  return '${stamp.day} ${months[stamp.month - 1]} ${stamp.year}';
}

/// Formats a maintenance due date with overdue awareness.
/// Returns ("Due in 3 days", false) or ("Overdue by 5 days", true).
({String label, bool isOverdue}) formatDue(DateTime due, {DateTime? now}) {
  final reference = now ?? DateTime.now();
  final diff = due.difference(reference);
  if (diff.isNegative) {
    final days = (-diff.inDays).abs();
    return (
      label: days == 0
          ? 'Overdue today'
          : 'Overdue by $days day${days == 1 ? '' : 's'}',
      isOverdue: true,
    );
  }
  final days = diff.inDays;
  if (days == 0) return (label: 'Due today', isOverdue: false);
  return (
    label: 'Due in $days day${days == 1 ? '' : 's'}',
    isOverdue: false,
  );
}
