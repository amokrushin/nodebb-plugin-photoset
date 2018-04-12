const async = require.main.require('async');
const winston = require.main.require('winston');
const db = require.main.require('./src/database');
const multiparty = require('multiparty');
const crypto = require('crypto');
const path = require('path');
const gcloud = require('gcloud');
const cheerio = require('cheerio');
const stream = require('stream');
const bs58 = require('bs58');
const gm = require('gm').subClass({ imageMagick: true });
const imageFilename = require('./../shared/image-filename');
const filenameHmac = require('./filename-hmac');
const _ = require('lodash');
const mime = require('mime-types');

function http400(res) {
    res.status(400).json('Bad Request');
}

function http403(res) {
    res.status(403).json('Forbidden');
}

function http404(res) {
    res.status(404).json('Not Found');
}

function http500(res, err) {
    res.status(503).json(err.message);
}

class Controllers {
    static renderAdminPage(req, res) {
        const Plugin = module.parent.exports;

        Plugin.updateStatus(null, () => {
            res.render('admin/plugins/photoset', {
                buckets: [],
                status: [Plugin.status],
            });
        });
    }

    static ipwSettings(req, res) {
        const pluginSettings = module.parent.exports.settings;
        const settings = _.pick(pluginSettings.get(), ['gcs', 'rmq']);

        _.assign(
            settings,
            {
                ipw: _.pick(pluginSettings.get('ipw'), ['version', 'transport']),
            },
        );

        res.status(200).end(JSON.stringify(settings));
    }

    static upload(req, res) {
        if (!req.user) return http403();

        const gcsSettings = module.parent.exports.settings.get('gcs');
        const photosetSettings = module.parent.exports.settings.get('photoset');
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const gcs = gcloud.storage({
            projectId: gcsSettings.projectId,
            credentials: {
                client_email: gcsSettings.credentials.clientEmail,
                private_key: gcsSettings.credentials.privateKey,
            },
        });
        const bucket = gcs.bucket(gcsSettings.bucket);
        const form = new multiparty.Form();
        const files = [];
        const imageTypes = [''];

        function streamImageTransfer(readStream, writeStream, callback) {
            const hashStream = crypto.createHash('md5').setEncoding('hex');
            const imageMetaStream = new stream.PassThrough();
            const fileinfo = {};

            fileinfo.mimetype = mime.lookup(readStream.filename);
            // fileinfo.ext = '.' + mime.extension( fileinfo.mimetype );
            fileinfo.ext = path.extname(readStream.filename).toLowerCase();
            fileinfo.isImage = /^image/.test(mime.lookup(readStream.filename));
            fileinfo.originalFilename = readStream.filename;
            fileinfo.uriFilename = readStream.filename
                .replace(/\d+_\d{13}/, '') // i + '_' + Date.now()
                .replace(/\s/g, '_')
                .replace(/[^a-zа-яё0-9()._-]/gi, '')
                .toLowerCase();

            readStream.on('data', (chunk) => {
                imageMetaStream.write(chunk);
                hashStream.write(chunk);
            });
            readStream.on('end', () => {
                imageMetaStream.end();
                hashStream.end();
            });

            imageMetaStream.on('error', callback);
            hashStream.on('error', callback);
            writeStream.on('error', callback);

            async.parallel([
                (cb) => {
                    if (!fileinfo.isImage) return cb();
                    gm(readStream)
                        .identify('%w,%h,%[EXIF:Orientation]', /* {bufferStream: true},*/ (err, data) => {
                            if (err) return cb(err);
                            if (!data) return cb(new Error('Wrong image'));
                            const meta = data.split(',');
                            fileinfo.originalWidth = meta[0];
                            fileinfo.originalHeight = meta[1];
                            fileinfo.exifOrientation = parseInt(meta[2]) || 0;
                            cb();
                        });
                },
                (cb) => {
                    hashStream.on('finish', () => {
                        fileinfo.hash = bs58.encode(new Buffer(hashStream.read(), 'hex'));
                        cb();
                    });
                },
                (cb) => {
                    writeStream.on('finish', () => {
                        cb();
                    });
                },
            ], (err) => {
                if (err) return callback(err);
                if (fileinfo.isImage) {
                    fileinfo.filename = imageFilename.encode(fileinfo, true);
                } else {
                    fileinfo.filename = fileinfo.hash;
                }
                callback(null, fileinfo);
            });

            readStream.pipe(writeStream);
        }

        const queue = async.queue((readStream, callback) => {
            const uploadsSetting = photosetSettings.uploads;
            const mimetype = mime.lookup(readStream.filename);
            const ext = path.extname(readStream.filename).toLowerCase();
            const isImage = /^image/.test(mimetype);
            const allowedTypes = isImage
                ? uploadsSetting.allowedImageTypes
                : uploadsSetting.allowedFileTypes;
            const allowedMaxFileSize = isImage
                ? uploadsSetting.allowedImageMaxFileSize
                : uploadsSetting.allowedFileMaxFileSize;
            const isAllowed = allowedTypes.includes(ext.replace('.', ''))
                && (readStream.byteCount <= allowedMaxFileSize);

            if (!isAllowed) {
                files.push({ filename: readStream.filename, error: 'invalid file type' });
                return callback();
            }

            const remoteFile = bucket.file(`temp-${Date.now()}`);
            const writeStream = remoteFile.createWriteStream();

            streamImageTransfer(readStream, writeStream, (err, fileinfo) => {
                if (err) {
                    files.push({ filename: readStream.filename, error: err.message });
                    return callback;
                }
                files.push(fileinfo);
                remoteFile.move(fileinfo.filename + fileinfo.ext, callback);
            });
        });

        form.on('part', (part) => {
            if (!part.filename) return;
            queue.push(part);
        });
        form.on('error', async.apply(http500, res));

        queue.drain = () => {
            async.map(files, (fileinfo, callback) => {
                if (fileinfo.error) {
                    return callback(null, {
                        name: fileinfo.filename,
                        url: fileinfo.error,
                    });
                }
                const filename = fileinfo.filename + fileinfo.ext;
                let urlFilename;
                // todo: imagePreviewMaxDimension
                if (fileinfo.isImage) {
                    urlFilename = imageFilename.thumbnail(filename, photosetSettings.imagePreviewMaxDimension || 800);
                    urlFilename = imageFilename.autoOrientation(urlFilename, fileinfo.exifOrientation, true);
                } else {
                    urlFilename = fileinfo.filename;
                }

                filenameHmac(photosetSettings.hmac.key, urlFilename + fileinfo.ext, (err, hmac) => {
                    callback(null, {
                        name: fileinfo.originalFilename,
                        url: `${baseUrl}/static/${hmac}/${urlFilename}/${fileinfo.uriFilename}`,
                    });
                });
            }, (err, files) => {
                res.status(200).send(req.xhr ? files : JSON.stringify(files));
            });
        };

        form.parse(req);
    }

    static download(req, res) {
        // todo: move to middleware
        if (/test\d{1,5}\.png$/.test(req.url)) {
            res.writeHead(200, { 'Content-Type': 'image/png' });
            const data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVQYV2P4DwABAQEAWk1v8QAAAABJRU5ErkJggg==';
            const buffer = new Buffer(data, 'base64');
            return res.end(buffer);
        }
        winston.debug('download request', 'start');

        const gcsSettings = module.parent.exports.settings.get('gcs');
        const photosetSettings = module.parent.exports.settings.get('photoset');
        const gcs = gcloud.storage({
            projectId: gcsSettings.projectId,
            credentials: {
                client_email: gcsSettings.credentials.clientEmail,
                private_key: gcsSettings.credentials.privateKey,
            },
        });
        const bucket = gcs.bucket(gcsSettings.bucket);
        const ipw = module.parent.exports.ipw;
        const urlParser = imageFilename.urlParser(req.url);

        if (!urlParser) return http400(res);

        function validateHmac(data, callback) {
            filenameHmac(photosetSettings.hmac.key, data.filename, (err, hmac) => {
                if (err) return callback(err);
                data.hmacValid = hmac === data.filenameHmac;
                winston.debug('download request', 'validateHmac', data.hmacValid);
                callback(null, data);
            });
        }

        function isRemoteFileExists(data, callback) {
            if (!data.hmacValid) return callback(null, data);
            if (data.fileExists) return callback(null, data); // function used twice
            // if( !data.resizeTaskNotExists ) return callback( null, data );
            bucket.file(data.filename).exists((err, fileExists) => {
                if (err) return callback(err);
                data.fileExists = !!fileExists;
                winston.debug('download request', 'isRemoteFileExists', data.fileExists);
                callback(null, data);
            });
        }

        function isResizeTaskExists(data, callback) {
            if (data.fileExists) return callback(null, data);
            if (!data.hmacValid) return callback(null, data);
            if (!data.isImage) return callback(null, data);
            db.client.HSETNX(['plugin:photoset:resizetask', data.encodedFilename, Date.now()], (err, reply) => {
                if (err) return callback(err);
                data.resizeTaskExists = !reply;
                if (!data.resizeTaskExists) {
                    winston.debug('download request', 'isResizeTaskExists', data.resizeTaskExists);
                    return callback(null, data);
                }
                db.getObjectField('plugin:photoset:resizetask', data.encodedFilename, (err, timestamp) => {
                    const timeout = (Date.now() - timestamp) > 60 * 1000;
                    data.resizeTaskExists = !timeout;
                    winston.debug('download request', 'isResizeTaskExists', data.resizeTaskExists);
                    callback(null, data);
                });
            });
        }

        function resizeRequest(data, callback) {
            if (data.fileExists) return callback(null, data);
            if (data.resizeTaskExists) return callback(null, data);
            if (!data.hmacValid) return callback(null, data);
            if (!data.isImage) return callback(null, data);
            winston.debug('download request', 'resizeRequest', 'start');
            ipw.request({
                bucket: gcsSettings.bucket,
                filename: data.filename,
            }, (err, res) => {
                if (err) return callback(err);
                winston.debug('download request', 'resizeRequest', 'end', res);
                db.deleteObjectField('plugin:photoset:resizetask', data.encodedFilename);
                data.fileExists = true;
                callback(null, data);
            });
        }

        function streamResponse(data, callback) {
            if (!data.fileExists) return callback(null, data);
            if (!data.hmacValid) return callback(null, data);
            winston.debug('download request', 'streamResponse', 'start');
            res.type(data.filename);
            bucket.file(data.filename).createReadStream()
                .on('end', () => {
                    winston.debug('download request', 'streamResponse', 'end');
                    callback(null, data);
                })
                .on('error', callback)
                .pipe(res);
        }

        async.waterfall([
            async.constant({
                filename: urlParser.encodedFilename + urlParser.ext,
                filenameHmac: urlParser.filenameHmac,
                encodedFilename: urlParser.encodedFilename,
                isImage: /^image/.test(mime.lookup(urlParser.ext.replace('.', ''))),
            }),
            validateHmac,
            isRemoteFileExists,
            isResizeTaskExists,
            resizeRequest,
            isRemoteFileExists,
            streamResponse,
        ], (err, data) => {
            if (err) {
                winston.error(err.stack);
                return http500(res, err);
            }

            if (!data.hmacValid) return http403(res);
            if (!data.fileExists) return http404(res);
            winston.debug('download request', 'finish');
        });
    }

    static postParser(post, next) {
        const photosetSettings = module.parent.exports.settings.get('photoset');
        const $ = cheerio.load(post.postData.content);

        const $images = $('img.img-markdown:not(a)');

        async.eachSeries($images, (imageEl, callback) => {
            const $image = $(imageEl);
            if ($image.hasClass('img-photoset')) return callback();
            const $container = $('<div class="photoset-grid hidden"></div>').insertBefore($image);
            const $photoset = $image.nextUntil(':not(img)').add($image);

            async.eachSeries($photoset, (imageEl, cb) => {
                const $image = $(imageEl);
                const urlParser = imageFilename.urlParser($image.attr('src'));

                /* not a plugin image */
                if (!urlParser) return cb();

                const encodedFilename = urlParser.encodedFilename + urlParser.ext;
                const imageinfo = imageFilename.decode(encodedFilename);

                /* unsupported format version */
                if (!imageinfo) return cb();

                $image.addClass('img-photoset not-responsive');
                $image.removeClass('img-responsive');
                $image.attr('width', imageinfo.width);
                $image.attr('height', imageinfo.height);
                const $link = $(`<a href="${$image.attr('src')}" target="_blank"></a>`);
                $container.append($link);
                $link.append($image);

                const thumbnail = imageFilename.thumbnail(
                    encodedFilename,
                    photosetSettings.imageHighresMaxDimension || 1920,
                    true,
                );
                filenameHmac(photosetSettings.hmac.key, thumbnail + imageinfo.ext, (err, hmac) => {
                    const url = `${urlParser.baseUrl + hmac}/${thumbnail}/${urlParser.originalFilename}${urlParser.ext}`;
                    $image.attr('data-hires', url);
                    cb();
                });
            }, callback);

            $container.attr('data-layout', $photoset.length);
        }, () => {
            post.postData.content = $.html();

            next(null, post);
        });
    }

    static postCreate(data, next) {
        // revert back original filename (default composer prepends it with "i + '_' + Date.now() + _" )
        data.post.content = data.post.content.replace(/(!\[)\d+_\d{13}_([^\]]+])/g, '$1$2');
        next(null, data);
    }

    static postEdit(data, next) {
        // revert back original filename (default composer prepends it with "i + '_' + Date.now() + _" )
        data.post.content = data.post.content.replace(/(!\[)\d+_\d{13}_([^\]]+])/g, '$1$2');
        next(null, data);
    }
}

module.exports = Controllers;
