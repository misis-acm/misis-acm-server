module.exports = {
    server: {
        port        : process.env.PORT || 8080,
        ip          : process.env.IP || '10.135.1.53' || '127.0.0.1',
        domains     : [ 'localhost:3000' ],
        cur_domain  : 0
    },
    db: process.env.PORT ? {
        host     : 'localhost',
        user     : 'ipritoflex',
        password : '',
        database : 'c9'
    } : {
        host     : 'localhost',
        user     : 'root',
        password : '115563',
        database : 'test'
    }
};