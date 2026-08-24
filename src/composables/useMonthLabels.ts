import { useI18n } from '@vasakgroup/tauri-plugin-i18n';

/** Claves de los meses en las traducciones, en orden de calendario. */
const MONTH_KEYS = [
	'january',
	'february',
	'march',
	'april',
	'may',
	'june',
	'july',
	'august',
	'september',
	'october',
	'november',
	'december',
] as const;

/**
 * Nombres de mes traducidos: largos para los encabezados de la grilla, cortos
 * para el timeline. `month` es el número de mes (1-12), como viene de las
 * fechas y de las entradas del timeline.
 */
export function useMonthLabels() {
	const { t } = useI18n();

	const monthLong = (month: number): string => t(`months.long.${MONTH_KEYS[month - 1]}`);
	const monthShort = (month: number): string => t(`months.short.${MONTH_KEYS[month - 1]}`);

	return { monthLong, monthShort };
}
