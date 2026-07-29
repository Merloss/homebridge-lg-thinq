export interface GatewayData {
    empTermsUri: string;
    empSpxUri: string;
    thinq2Uri: string;
    thinq1Uri: string;
    countryCode: string;
    languageCode: string;
}
export declare class Gateway {
    data: GatewayData;
    constructor(data: GatewayData);
    get emp_base_url(): string;
    get login_base_url(): string;
    get thinq2_url(): string;
    get thinq1_url(): string;
    get country_code(): string;
    get language_code(): string;
}
