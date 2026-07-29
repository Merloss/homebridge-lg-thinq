export default function TotalConsumption(DefaultCharacteristic) {
    return class TotalConsumption extends DefaultCharacteristic {
        // Eve Energy - Total consumption
        static UUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52';
        constructor() {
            super('Total Consumption', TotalConsumption.UUID, {
                format: "float" /* Formats.FLOAT */,
                unit: 'kWh',
                minValue: 0,
                maxValue: 1000000,
                minStep: 0.01,
                perms: ["pr" /* Perms.PAIRED_READ */, "ev" /* Perms.NOTIFY */],
            });
        }
    };
}
//# sourceMappingURL=TotalConsumption.js.map