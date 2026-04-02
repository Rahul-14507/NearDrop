import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:neardrop/core/constants/strings.dart';
import 'package:neardrop/core/theme/app_theme.dart';
import 'package:neardrop/features/hub/bloc/hub_bloc.dart';
import 'package:neardrop/features/hub/bloc/hub_state.dart';
import 'package:neardrop/features/hub/models/hub_model.dart';
import 'package:neardrop/features/hub/widgets/earnings_summary_card.dart';

class EarningsScreen extends StatelessWidget {
  const EarningsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<HubBloc, HubState>(
      builder: (context, state) {
        HubStatsModel? stats;
        if (state is HubStatsLoaded) stats = state.stats;
        if (state is HubBroadcastsLoaded) stats = state.hubStats;
        if (state is HubLoading) stats = state.stats;

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (stats != null) ...[
              EarningsSummaryCard(stats: stats),
              const SizedBox(height: 20),
            ] else ...[
              const _EarningsSkeletonCard(),
              const SizedBox(height: 20),
            ],

            // Weekly chart
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppStrings.weeklyEarnings,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      height: 180,
                      child: _WeeklyBarChart(
                        todayEarnings: stats?.todayEarnings ?? 0,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _WeeklyBarChart extends StatelessWidget {
  final double todayEarnings;

  const _WeeklyBarChart({required this.todayEarnings});

  @override
  Widget build(BuildContext context) {
    // Mock weekly data with today as last bar
    final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final values = [75.0, 125.0, 50.0, 175.0, 100.0, 200.0, todayEarnings];
    final today = DateTime.now().weekday - 1; // 0=Mon

    return BarChart(
      BarChartData(
        alignment: BarChartAlignment.spaceAround,
        maxY: 250,
        barGroups: List.generate(
          7,
          (i) => BarChartGroupData(
            x: i,
            barRods: [
              BarChartRodData(
                toY: values[i],
                color: i == today
                    ? AppColors.accent
                    : AppColors.accent.withOpacity(0.35),
                width: 18,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(6),
                ),
              ),
            ],
          ),
        ),
        titlesData: FlTitlesData(
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (value, _) => Text(
                days[value.toInt()],
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                ),
              ),
            ),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 40,
              getTitlesWidget: (value, _) => Text(
                '₹${value.toInt()}',
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 10,
                ),
              ),
            ),
          ),
          topTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        gridData: FlGridData(
          drawVerticalLine: false,
          getDrawingHorizontalLine: (_) => FlLine(
            color: AppColors.divider,
            strokeWidth: 1,
          ),
        ),
        borderData: FlBorderData(show: false),
      ),
    );
  }
}

class _EarningsSkeletonCard extends StatelessWidget {
  const _EarningsSkeletonCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 120,
              height: 14,
              decoration: BoxDecoration(
                color: AppColors.divider,
                borderRadius: BorderRadius.circular(7),
              ),
            ),
            const SizedBox(height: 12),
            Container(
              width: 160,
              height: 32,
              decoration: BoxDecoration(
                color: AppColors.divider,
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            const SizedBox(height: 20),
            const CircularProgressIndicator(
              color: AppColors.accent,
              strokeWidth: 2,
            ),
          ],
        ),
      ),
    );
  }
}
