export function formatPlateInput(value: string): string {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean) return "";
    const match = clean.match(/^([A-Z]+)(\d*)$/);
    if (match) {
        const letters = match[1];
        const digits = match[2];
        if (digits) {
            return `${letters} ${digits.slice(0, 4)}`;
        }
        return letters.slice(0, 4);
    }
    if (clean.length > 3) {
        return `${clean.slice(0, 3)} ${clean.slice(3, 7)}`;
    }
    return clean;
}
