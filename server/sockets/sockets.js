/*
 * Acm system
 * https://github.com/IPRIT
 *
 * Copyright (c) 2015 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 * Created on 05.12.2015
 */


var io,
    salt = 'misis_acm_belov',
    initTime;

var crypto = require('crypto');

module.exports = {
    create: Create,
    handle: Handle,
    getIo: GetIO,
    getRoomHash: getRoomHash,
    salt: salt
};

function Create(s_io) {
    io = s_io;
    initTime = new Date().getTime();
}

function GetIO() {
    return io;
}

function Handle(socket) {
    console.log('Connected:', socket.id);

    socket.emit('server started', {
        socket_id: socket.id,
        startedAt: initTime
    });

    socket.on('join contest', function (data) {
        if (!data.contest_id) {
            return;
        }
        console.log('Join to contest:', data.contest_id);
        var contestHashKey = getRoomHash(data.contest_id);
        socket.join(contestHashKey);
    });

    socket.on('leave contest', function (data) {
        if (!data.contest_id) {
            return;
        }
        var contestHashKey = getRoomHash(data.contest_id);
        socket.leave(contestHashKey);
    });

    socket.on('disconnect', function (data) {
        console.log('Disconnected:', socket.id);
    });
}

function getRoomHash(str) {
    return crypto.createHash('md5').update(str + salt).digest('hex');
}