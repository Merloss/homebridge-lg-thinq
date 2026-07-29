export class Gateway {
    data;
    constructor(data) {
        this.data = data;
    }
    get emp_base_url() {
        return this.data.empTermsUri + '/';
    }
    get login_base_url() {
        return this.data.empSpxUri + '/';
    }
    get thinq2_url() {
        return this.data.thinq2Uri + '/';
    }
    get thinq1_url() {
        return this.data.thinq1Uri + '/';
    }
    get country_code() {
        return this.data.countryCode;
    }
    get language_code() {
        return this.data.languageCode;
    }
}
//# sourceMappingURL=Gateway.js.map