/*
 * Acm system
 * https://github.com/IPRIT
 *
 * Copyright (c) 2015 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 * Created on 08.11.2015
 */

'use strict';

var express = require('express');
var router = express.Router();
var app = express();

var authManager = require('../internal/user/auth/auth');

router.all('/', function (req, res) {
    res.json({
        'current state': 'API RUNNING'
    });
});

router.all('/auth', function (req, res) {
    res.json({
        'current state': 'AUTH RUNNING'
    });
});

router.post('/auth/signIn', function (req, res) {

    execute({}, function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(data, callback) {
        var bodyRequest = req.body;
        authManager.auth(req, res, bodyRequest.username, bodyRequest.password, function (err, result) {
            if (err || !result) {
                return callback({ error: { error_message: err.toString() } });
            }
            callback(null, { result: true, user: result.getObjectFactory() });
        })
    }
});

router.post('/auth/logout', function (req, res) {

    execute({}, function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(data, callback) {
        authManager.logout(req, res, function (err, result) {
            if (err || !result) {
                return callback({ error: { error_message: err.toString() } });
            }
            callback(null, { result: result });
        })
    }
});

router.get('/auth/isAuth', function (req, res) {

    execute({}, function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(data, callback) {
        authManager.isAuth(req, res, function (err, result) {
            if (err || !result) {
                return callback({ error: { error_message: err.toString() } });
            }
            callback(null, result);
        })
    }
});

module.exports = router;