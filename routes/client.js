var net = require('net');

exports.action = function (req, res) {
    var id = req.query.id;
    var action = req.params.action;

    var device = net.connect({ host: '127.0.0.1', port: id }, function () {
        device.write('GET /' + action + ' HTTP/1.1\r\n\r\n');
    });

    device.on('data', function (data) {
        if (res.connection) {
            res.connection.write(data);
        }
    });

    device.on('error', function (error) {
        res.send(500);
    });
};

