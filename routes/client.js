var net = require('net');
var querystring = require('querystring');

exports.action = function (req, res) {
    var id = req.query.id;
    var action = req.params.action;

    var device = net.connect({ host: '127.0.0.1', port: id }, function () {
        device.write('GET /client/' + action + ' HTTP/1.1\r\n\r\n');
    });

    device.on('data', function (data) {
        if (res.connection) {
            res.connection.write(data);
        }
    });

    device.on('error', function (error) {
        res.send(500);
    });

    device.setTimeout(5 * 1000, function () {
        if (res.connection)
            res.connection.end();
        device.end();
    });
};

exports.authorize = function (req, res) {
    var id = req.query.id,
        username = req.body.username,
        password = req.body.password;

    var device = net.connect({ host: '127.0.0.1', port: id }, function () {
        var req_body = querystring.stringify({ username: username, password: password });

        device.write('POST /client/authorize  HTTP/1.1\r\n');
        device.write('Content-Length: ' + req_body.length + '\r\n\r\n');
        device.write(req_body);
    });

    var res_data = '';

    res.set('Access-Control-Allow-Origin', req.headers.origin);
    res.set('Access-Control-Allow-Credentials', true);

    device.on('data', function (data) {
        var m, res_code;

        res_data += data.toString();

        if (m = res_data.match(/^HTTP\/1.1 (\d+) .*\r\n(.*\r\n)+\r\n$/)) {
            res_code = parseInt(m[1]);

            if (res_code == 200) {
                req.session.username = username;
                req.session.password = password;
            }

            res.send(res_code);
        }
    });

    device.on('error', function (error) {
        res.send(500);
    });

    device.setTimeout(5 * 1000, function () {
        if (res.connection)
            res.connection.end();
        device.end();
    });
};
