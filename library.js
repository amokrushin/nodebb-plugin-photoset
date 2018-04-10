const gcloud = require('gcloud');
const crypto = require('crypto');
const async = require('async');
const winston = require('winston');
const request = require('request');
const _ = require('lodash');
const controllers = require('./lib/controllers');
const middlewares = require('./lib/middlewares');
const npmPackage = require('./package.json');

const SocketPlugins = require.main.require('./src/socket.io/plugins');
const db = require.main.require('./src/database');
const Settings = module.parent.require('./settings');

const rmq = require('am-rmq')(winston);
const ipw = require('./lib/ipw')(rmq);

const Plugin = {
    settings: {},
    ipw,
    status: {
        redis: {},
        gcs: {},
        rmq: {},
        ipw: {
            workers: {},
            updateTriggeredAt: 0,
        },
        proxyCache: {},
        photoset: {},
    },
};

function initSettings(callback) {
    winston.info('[nodebb-plugin-photoset]', 'initSettings');
    const defaultSettings = {
        gcs: {
            projectId: '',
            credentials: {
                clientEmail: '',
                privateKey: '',
            },
            bucket: '',
        },
        rmq: {
            host: '',
            user: '',
            password: '',
            vhost: '',
        },
        ipw: {
            version: '0.2.0',
            transport: 'rmq',
            apiKeys: [],
        },
        photoset: {
            hmac: {
                key: '',
            },
            uploads: {
                allowedImageTypes: ['jpg', 'png', 'gif'],
                allowedImageMaxFileSize: 20 * 1024 * 1024,
                allowedFileTypes: ['pdf'],
                allowedFileMaxFileSize: 1024 * 1024,
            },
        },
    };

    // note: nodebb settings module breaks arrays after version change, so settings version is not used
    const settings = new Settings('photoset', '0', defaultSettings, () => {
        settings.set('plugin.version', npmPackage.version);
        settings.set('ipw.version', defaultSettings.ipw.version);
        settings.set('photoset.uploads', defaultSettings.photoset.uploads);
        if (!settings.get('photoset.hmac.key')) {
            const hmacKey = crypto.randomBytes(64).toString('hex');
            settings.set('photoset.hmac.key', hmacKey);
        }
        settings.persist(() => {
            callback(settings);
        });
    }, false);
}


Plugin.init = function init(params, callback) {
    winston.info('[nodebb-plugin-photoset]', 'init');
    const router = params.router;
    const hostMiddleware = params.middleware;

    router.get('/admin/plugins/photoset', hostMiddleware.admin.buildHeader, controllers.renderAdminPage);
    router.get('/api/admin/plugins/photoset', controllers.renderAdminPage);
    router.get('/api/plugins/photoset/settings', middlewares.apiKey, controllers.ipwSettings);

    router.get('/static/*', controllers.download);


    /* override default nodebb uploads route */
    router.post('/api/post/upload', hostMiddleware.applyCSRF, controllers.upload);

    initSettings((settings) => {
        winston.info('[nodebb-plugin-photoset]', 'initSettings done');
        Plugin.settings = settings;
        if (settings.get('rmq.host') && settings.get('rmq.user') && settings.get('rmq.password')) {
            rmq.connect(settings.get('rmq'), true);
        }
        callback();
    });

    db.getObjectField('plugin:photoset', 'status', (err, status) => {
        if (err) return callback(err);
        if (status) {
            Plugin.status = JSON.parse(status);
        } else {
            db.setObjectField('plugin:photoset', 'status', JSON.stringify(Plugin.status), (err) => {
                if (err) return callback(err);
            });
        }
    });
};


Plugin.parse = controllers.postParser;
Plugin.postCreate = controllers.postCreate;
Plugin.postEdit = controllers.postEdit;

Plugin.addAdminNavigation = (header, callback) => {
    header.plugins.push({
        route: '/plugins/photoset',
        icon: 'fa-tint',
        name: 'Photoset',
    });

    callback(null, header);
};


Plugin.updateStatus = (modules, callback) => {
    function saveStatus(cb) {
        db.setObjectField('plugin:photoset', 'status', JSON.stringify(Plugin.status), cb);
    }

    Plugin.settings.sync(() => {
        async.parallel([
            !modules || !modules.includes('gcs') ? gcsStatus : async.constant(),
            !modules || !modules.includes('rmq') ? rmqStatus : async.constant(),
            !modules || !modules.includes('proxyCache') ? proxyCacheStatus : async.constant(),
        ], async.apply(async.series, [
            !modules || !modules.includes('ipw') ? ipwStatus : async.constant(),
            !modules || !modules.includes('photoset') ? photosetStatus : async.constant(),
            saveStatus,
        ], callback));
    });
};

/*
 WebSocket methods
 */
SocketPlugins.photoset = {};

SocketPlugins.photoset.status = (socket, module, callback) => {
    Plugin.updateStatus(module, () => {
        callback(null, Plugin.status);
    });
};

SocketPlugins.photoset.syncSettings = (socket, data, callback) => {
    Plugin.settings.sync(callback);
};

SocketPlugins.photoset.apiKeyNew = (socket, data, callback) => {
    crypto.randomBytes(40, (ex, buf) => {
        const apiKey = buf.toString('hex');
        const apiKeys = Plugin.settings.get('irw.apiKeys') || [];
        apiKeys.push(apiKey);
        Plugin.settings.set('irw.apiKeys', apiKeys);
        Plugin.settings.persist(() => {
            callback(null, apiKey);
        });
    });
};

SocketPlugins.photoset.apiKeyRemove = (socket, apiKey, callback) => {
    const apiKeys = Plugin.settings.get('irw.apiKeys') || [];
    _.remove(apiKeys, item => !item || item === apiKey);
    Plugin.settings.set('irw.apiKeys', apiKeys);
    Plugin.settings.persist(callback);
};

SocketPlugins.photoset.gcsBuckets = (socket, data, callback) => {
    const settings = Plugin.settings.get('gcs');
    const gcs = gcloud.storage({
        projectId: settings.projectId,
        credentials: {
            client_email: settings.credentials.clientEmail,
            private_key: settings.credentials.privateKey,
        },
    });

    gcs.getBuckets((err, res) => {
        if (err) return callback(err);
        const buckets = res.map(bucket => bucket.metadata.name);
        callback(null, buckets);
    });
};

function gcsStatus(callback) {
    const settings = Plugin.settings.get('gcs');

    Plugin.status.gcs.success = false;
    Plugin.status.gcs.connection = false;
    Plugin.status.gcs.message = '';

    if (!settings.projectId || !settings.credentials.clientEmail || !settings.credentials.privateKey) {
        Plugin.status.gcs.message = 'Not configured';
        return callback();
    }

    const gcs = gcloud.storage({
        projectId: settings.projectId,
        credentials: {
            client_email: settings.credentials.clientEmail,
            private_key: settings.credentials.privateKey,
        },
    });

    // todo: projectId not verified
    gcs.bucket(Date.now().toString()).getMetadata((err) => {
        if (err && err.code === 404) {
            Plugin.status.gcs.connection = true;
            if (settings.bucket) {
                Plugin.status.gcs.success = true;
                return callback();
            }
        }
        Plugin.status.gcs.message = 'Bucket not selected';
        if (err && err.code !== 404) Plugin.status.gcs.message = err.message;
        if (!err.message.includes('PEM')) Plugin.status.gcs.message = 'Invalid private key';
        if (!err.message.includes('KEY')) Plugin.status.gcs.message = 'Invalid private key';
        if (!err.message.includes('invalid_grant')) Plugin.status.gcs.message = 'Invalid client email';
        callback();
    });
}

function rmqStatus(callback) {
    const settings = Plugin.settings.get('rmq');

    Plugin.status.rmq.success = false;
    Plugin.status.rmq.message = '';

    if (!settings.host || !settings.user || !settings.password) {
        Plugin.status.rmq.message = 'Not configured';
        return callback();
    }

    rmq.connect(settings, false, (err) => {
        if (err) {
            return callback();
        }
        Plugin.status.rmq.success = true;
        callback();
    });
}

function ipwStatus(callback) {
    if (!Plugin.status.rmq.success) {
        Plugin.status.ipw.message = 'RabbitMQ required';
        return callback();
    }

    Plugin.status.ipw.success = false;
    Plugin.status.ipw.updateRequired = false;
    Plugin.status.ipw.updateInProgress = false;
    Plugin.status.ipw.message = '';

    function triggerWorkersUpdate() {
        if ((Date.now() - Plugin.status.ipw.updateTriggeredAt) > 5 * 60 * 1000) {
            Plugin.status.ipw.updateTriggeredAt = Date.now();
            ipw.update(Plugin.settings.get('ipw.version'));
        }
    }

    ipw.discovery((err, data) => {
        const activeWorkers = _.indexBy(data, 'uuid');
        const storedWorkers = _.indexBy(Plugin.status.ipw.workers, 'uuid');
        const workers = _.assign({}, storedWorkers, activeWorkers);

        _.forEach(activeWorkers, (worker) => {
            worker.status = 'active';
            if (worker.version !== Plugin.settings.get('ipw.version')) {
                worker.status = 'updating';
                worker.updateStartedAt = Date.now();
                Plugin.status.ipw.updateRequired = true;
            }
        });

        _.forEach(storedWorkers, (worker) => {
            if (worker.status === 'active') worker.status = 'inactive';
            if (worker.updateStartedAt) {
                if (Date.now() > worker.updateStartedAt + (2 * 60 * 1000)) {
                    worker.status = 'fail';
                }
            }
        });

        _.forEach(workers, (worker) => {
            if (worker.status === 'updating') Plugin.status.ipw.updateInProgress = true;
        });

        Plugin.status.ipw.workers = _.sortByOrder(_.values(workers), ['startedAt'], ['desc']);
        Plugin.status.ipw.success = !!Plugin.status.ipw.workers.length;

        if (Plugin.status.ipw.updateRequired) triggerWorkersUpdate();

        return callback();
    });
}

function proxyCacheStatus(callback) {
    const imageId = Math.ceil((Date.now() / 1000 / 60 / 60 / 24)) - 400;
    const url = `https://community.steelcar.ru/static/test${imageId}.png`;

    async.retry(2,
        (cb) => {
            request(url, (err, response) => {
                if (err) return cb(err);
                if (response.statusCode !== 200) return cb(new Error(`HTTP${response.statusCode}`));
                const xProxyCache = response.headers['x-proxy-cache'];
                if (!xProxyCache) return cb(new Error('Proxy cache unconfigured'));
                if (xProxyCache === 'MISS') return cb(new Error('Proxy cache MISS'));
                if (xProxyCache === 'HIT') return cb();
                cb(new Error('Unknown "x-proxy-cache" header value'));
            });
        },
        (err) => {
            Plugin.status.proxyCache = { success: !err, message: err ? err.message : '' };
            callback();
        });
}

function photosetStatus(callback) {
    Plugin.status.photoset.success = Plugin.status.gcs.success
        && Plugin.status.rmq.success
        && Plugin.status.ipw.success;
    callback();
}

module.exports = Plugin;
