// The analytics lesson's three charts. Each takes the validated analytics result (LabRun.result)
// and the run it came from, so the figure carries exactly one tierLabel().
export { HourlyChart } from './HourlyChart'
export { WeatherChart } from './WeatherChart'
export { WeekHeatmap, DEFAULT_WEEK_DOMAIN, effectiveDomain } from './WeekHeatmap'
export { ChartFigure, type Provenance } from './ChartFigure'
export { chartSummary, hourlySummary, weatherSummary, weekSummary, scenarioOf, type Measure } from './summary'
export { one, count, clock, sourceLabel, periodLabel } from './format'
