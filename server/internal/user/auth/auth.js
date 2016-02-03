/*
 * Acm system
 * https://github.com/IPRIT
 *
 * Copyright (c) 2015 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 */

'use strict';

var User = require('../user');
var crypto = require('crypto');

var AUTH_COOKIE_NAME = 'auth.sid';

module.exports = {
    restore: RestoreUser,
    auth: AuthUser,
    logout: LogoutUser,
    isAuth: IsAuth
};

function RestoreUser(req, res, next) {
    var session = req.session;
    if (!session || !session.user_id) {
        return RestoreUserByCookie.apply(this, arguments);
    }
    GetUserById(session.user_id, function (err, user) {
        if (err) {
            return next();
        }
        user._ip = req.headers['x-real-ip'] || req.ip || req.ips;
        req.currentUser = user;
        next();
    });
}

function RestoreUserByCookie(req, res, next) {
    var cookies = req.cookies;
    if (!(AUTH_COOKIE_NAME in cookies)) {
        return next();
    }
    GetUserByAccessKey(cookies[AUTH_COOKIE_NAME], function (err, user) {
        if (err) {
            return next();
        }
        user._ip = req.headers['x-real-ip'] || req.ip || req.ips;
        req.currentUser = user;
        req.session.user_id = user.getId();
        next();
    });
}

function GetUserByAccessKey(accessKey, callback) {
    var user = new User();
    user.allocateByAccessKey(accessKey, function (err) {
        if (err) {
            return callback(err);
        }
        callback(null, user);
    });
}

function GetUserById(user_id, callback) {
    var user = new User();
    user.allocate(user_id, function (err) {
        if (err) {
            return callback(err);
        }
        callback(null, user);
    });
}

function AuthUser(req, res, login, password, callback) {
    if (!login || !login.length || !password || !password.length) {
        return;
    }
    var user = new User();
    user.allocateByLogin(login, function (err) {
        if (err) {
            return callback(err);
        }
        if (user.isPasswordEquals(password)) {
            var newAccessToken = user.generateAccessKey();
            user.addAccessKey(newAccessToken, function (err, accessKeys) {
                if (err) {
                    return callback(err);
                }
                res.cookie(AUTH_COOKIE_NAME, newAccessToken, {
                    expires: new Date(Date.now() + 1e3 * 3600 * 24 * 365),
                    httpOnly: true
                });
                req.session.user_id = user.getId();
                user.updateLastLoggedTime();
                user.updateRecentActionTime();
                callback(null, user);
            });
        } else {
            callback(new Error('Wrong password', 3001));
        }
    });
}

function LogoutUser(req, res, callback) {
    var user = req.currentUser;
    if (!user || user.isEmpty()) {
        return callback(null, true);
    }
    var accessKey = req.cookies['auth.sid'];
    if (!accessKey || typeof accessKey !== 'string') {
        return callback(null, true);
    }
    res.cookie('auth.sid', '', {
        expires: new Date(Date.now() - 1e3 * 3600 * 24 * 365)
    });
    delete req.session.user_id;
    user.deleteAccessKey(accessKey, function (err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, result);
    })
}

function IsAuth(req, res, callback) {
    var user = req.currentUser;
    if (!user || user.isEmpty()) {
        return callback(null, {
            result: false
        });
    }
    callback(null, {
        result: true,
        user: user.getObjectFactory()
    });
}
