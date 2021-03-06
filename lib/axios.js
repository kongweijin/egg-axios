const axios = require('axios');
const { merge: deepMerge } = require('lodash');
const qstring = require('querystring');
const urlTools = require('url');

function MyAxios(app) {
    this.app = app;
    this.init();
}

function mappingUrl(url, params) {
    if (!url || !params) {
        return [url, params];
    }
    if (typeof params !== 'object') {
        return [url, params];
    }
    const newParams = {};
    for (const key in params) {
        const reg = new RegExp(`:${key}`, 'g');
        if (reg.test(url)) {
            url = url.replace(reg, params[key]);
        } else {
            newParams[key] = params[key];
        }
    }
    return [url, newParams];
}

MyAxios.prototype.init = function () {
    const self = this;
    const defaultConfig = {
        headers: {
            common: {
                'Content-Type': 'application/json; charset=UTF-8'
            }
        },
        timeout: 10000
    };

    axios.defaults = deepMerge(axios.defaults, defaultConfig, self.app.config.http);

    self.app.logger.info(`egg-axios defaults: ${JSON.stringify(axios.defaults)}`);

    axios.interceptors.request.use(function (config) {
        self.app.coreLogger.debug(`[egg-axios] send request, baseURL: ${JSON.stringify(config.baseURL)}, url: ${config.url}, method: ${config.method}, data: ${JSON.stringify(config.data)}, headers: ${JSON.stringify(config.headers)}`);
        return config;
    }, function (error) {
        self.app.coreLogger.error(`[egg-axios] send request error, ${error.message}`);
        return Promise.reject(error);
    });

    axios.interceptors.response.use(function (response) {
        self.app.coreLogger.debug(`[egg-axios] receive response, data: ${JSON.stringify(response.data)}, status: ${response.status}, headers: ${JSON.stringify(response.headers)}`);
        if (response.config && (response.config.method.toUpperCase() === 'HEAD' || response.config.method.toUpperCase() === 'options')) {
            return response;
        } else {
            return response.data;
        }
    }, function (error) {
        self.app.coreLogger.error(`[egg-axios] receive response error, ${error.message}`);
        return Promise.reject(error);
    });
};

for (let method of ['delete', 'get', 'head', 'options']) {
    MyAxios.prototype[method] = function (url, data, config) {
        [url, data] = mappingUrl(url, data);
        const urlParse = urlTools.parse(url);
        if (urlParse.query) {
            data = Object.assign(qstring.parse(urlParse.query), data);
        }
        const port = urlParse.port ? `:${urlParse.port}` : '';
        if (data && typeof data === 'object') {
            url = `${urlParse.protocol}//${urlParse.host}${port}${urlParse.pathname}?${qstring.stringify(data)}`;
        }
        return axios[method](url, config);
    };
}

for (let method of ['post', 'put', 'patch']) {
    MyAxios.prototype[method] = function (url, data, config) {
        [url, data] = mappingUrl(url, data);
        return axios[method](url, data, config);
    };
}

module.exports = MyAxios;