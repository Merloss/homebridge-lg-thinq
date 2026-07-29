import { ValueType } from './DeviceModel.js';
export function coerceModelValue(model, key, value) {
    if (!model) {
        return value;
    }
    try {
        const valueModel = model.value(key);
        if (!valueModel) {
            return value;
        }
        switch (valueModel.type) {
            case ValueType.Bit: {
                if (typeof value === 'boolean') {
                    return value ? 1 : 0;
                }
                if (typeof value === 'string') {
                    const numberValue = Number(value);
                    return Number.isNaN(numberValue) ? (value === '1' ? 1 : 0) : numberValue;
                }
                return value;
            }
            case ValueType.Range: {
                if (value === null || value === undefined) {
                    return value;
                }
                if (typeof value === 'number') {
                    return value;
                }
                const numberValue = Number(value);
                return Number.isNaN(numberValue) ? value : numberValue;
            }
            case ValueType.Enum: {
                if (typeof value === 'string') {
                    const enumKey = model.enumValue(key, value);
                    return enumKey !== null ? enumKey : value;
                }
                return value;
            }
            default: {
                return value;
            }
        }
    }
    catch (e) {
        return value;
    }
}
export function coerceDataSetList(dataSetList, model) {
    if (!dataSetList || typeof dataSetList !== 'object') {
        return;
    }
    for (const key of Object.keys(dataSetList)) {
        const value = dataSetList[key];
        const coerced = coerceModelValue(model, key, value);
        dataSetList[key] = coerced;
        if (coerced === value && value && typeof value === 'object') {
            coerceDataSetList(value, model);
        }
    }
}
export function normalizeBooleanValues(value) {
    if (!value || typeof value !== 'object') {
        return;
    }
    for (const key of Object.keys(value)) {
        const child = value[key];
        if (typeof child === 'boolean') {
            value[key] = child ? 1 : 0;
        }
        else if (child && typeof child === 'object') {
            normalizeBooleanValues(child);
        }
    }
}
export function coerceCommandPayload(values, model) {
    if (values && typeof values === 'object') {
        if ('dataKey' in values && values.dataKey && 'dataValue' in values) {
            values.dataValue = coerceModelValue(model, values.dataKey, values.dataValue);
        }
        if ('dataSetList' in values && values.dataSetList && typeof values.dataSetList === 'object') {
            coerceDataSetList(values.dataSetList, model);
        }
    }
    normalizeBooleanValues(values);
}
//# sourceMappingURL=commandPayload.js.map