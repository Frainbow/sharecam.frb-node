var net = require('net');
var url = require('url');
var querystring = require('querystring');

var device_sockets = [];
var device_server = net.createServer(function (device_conn) {

    var client_sockets = [];
    var device_request = {};
    var device_id = device_sockets.length;

    device_sockets.push(device_conn);

    console.log('device ' + device_id + ' connected');

    device_conn.on('data', function (data) {
        var m, index, data_str = data.toString();

        if (m = data_str.match(/^(GET|POST) (.*) HTTP\/1\.[01]/)) {
            device_request = {};
            device_request.method = m[1];
            device_request.url = m[2];

            if (device_request.method == 'GET') {
                device_request.header = data_str;
                device_request.body = new Buffer(0);
                device_request.end = device_request.header.length > 4 && device_request.header.substr(-4, 4) == '\r\n\r\n';
            } else if (device_request.method == 'POST') {
                index = data_str.indexOf('\r\n\r\n');
                device_request.header = (index == -1) ? data_str : data_str.substr(0, index + 4);
                device_request.length = (m = device_request.header.match(/Content-Length: (\d+)/)) ? m[1] : 0;
                device_request.body = index != -1 ? data.slice(index + 4, data.length) : new Buffer(0);
                device_request.end = index != -1 && device_request.body.length >= device_request.length;
            }
        } else if (!device_request.end && device_request.method == 'GET') {
            device_request.header += data_str;
            device_request.end = device_request.header.length > 4 && device_request.header.substr(-4, 4) == '\r\n\r\n';
        } else if (!device_request.end && device_request.method == 'POST') {
            if (device_request.header.length > 4 && device_request.header.substr(-4, 4) == '\r\n\r\n') {
                device_request.body = Buffer.concat([device_request.body, data]);
                device_request.end = device_request.body.length >= device_request.length;
            } else {
                index = data_str.indexOf('\r\n\r\n');
                device_request.header += (index == -1) ? data_str : data_str.substr(0, index + 4);
                device_request.length = (m = device_request.header.match(/Content-Length: (\d+)/)) ? m[1] : 0;
                device_request.body = index != -1 ? data.slice(index + 4, data.length) : new Buffer(0);
                device_request.end = index != -1 && device_request.body.length >= device_request.length;
            }
        }

        if (!device_request.end) {
            return;
        }

        console.log('device ' + device_id + ' ' + device_request.url);

        var device_param = querystring.parse(device_request.body.toString());

        if (device_request.method == 'POST' &&
            url.parse(device_request.url).pathname == '/device/connect' &&
            device_param.username !== undefined &&
            device_param.password !== undefined
        ) {

            var device_auth = device_param;

            var client_server = net.createServer(function (client_conn) {

                var authorized = false;
                var client_request = {};
                var client_id = client_sockets.length;

                client_sockets.push(client_conn);

                console.log('client ' + [device_id, client_id].join(':')  + ' connected');

                client_conn.on('data', function (data) {
                    var m, index, data_str = data.toString();

                    if (authorized) {
                        device_conn.write(data);
                        return;
                    }

                    if (m = data_str.match(/^(GET|POST) (.*) HTTP\/1\.[01]/)) {
                        client_request = {};
                        client_request.method = m[1];
                        client_request.url = m[2];

                        if (client_request.method == 'GET') {
                            client_request.header = data_str;
                            client_request.body = new Buffer(0);
                            client_request.end = client_request.header.length > 4 && client_request.header.substr(-4, 4) == '\r\n\r\n';
                        } else if (client_request.method == 'POST') {
                            index = data_str.indexOf('\r\n\r\n');
                            client_request.header = (index == -1) ? data_str : data_str.substr(0, index + 4);
                            client_request.length = (m = client_request.header.match(/Content-Length: (\d+)/)) ? m[1] : 0;
                            client_request.body = index != -1 ? data.slice(index + 4, data.length) : new Buffer(0);
                            client_request.end = index != -1 && client_request.body.length >= client_request.length;
                        }
                    } else if (!client_request.end && client_request.method == 'GET') {
                        client_request.header += data_str;
                        client_request.end = client_request.header.length > 4 && client_request.header.substr(-4, 4) == '\r\n\r\n';
                    } else if (!client_request.end && client_request.method == 'POST') {
                        if (client_request.header.length > 4 && client_request.header.substr(-4, 4) == '\r\n\r\n') {
                            client_request.body = Buffer.concat([client_request.body, data]);
                            client_request.end = client_request.body.length >= client_request.length;
                        } else {
                            index = data_str.indexOf('\r\n\r\n');
                            client_request.header += (index == -1) ? data_str : data_str.substr(0, index + 4);
                            client_request.length = (m = client_request.header.match(/Content-Length: (\d+)/)) ? m[1] : 0;
                            client_request.body = index != -1 ? data.slice(index + 4, data.length) : new Buffer(0);
                            client_request.end = index != -1 && client_request.body.length >= client_request.length;
                        }
                    }

                    if (!client_request.end) {
                        return;
                    }

                    var client_param = querystring.parse(client_request.body.toString());

                    console.log('client ' + [device_id, client_id].join(':') + ' ' + client_request.url);

                    if (
                        client_request.method == 'POST' &&
                        url.parse(client_request.url).pathname == '/client/authorize' &&
                        client_param.username !== undefined &&
                        client_param.password !== undefined
                    ) {
                        var client_auth = client_param;

                        if (client_auth.username === device_auth.username && client_auth.password === device_auth.password) {
                            authorized = true;
                            client_conn.write('HTTP/1.1 200 OK\r\n');
                            client_conn.write('Content-Length: 0\r\n\r\n');
                        } else {
                            client_conn.write('HTTP/1.1 403 FORBIDDEN\r\n');
                            client_conn.write('Content-Length: 0\r\n\r\n');
                        }
                        client_request = {};
                        return;
                    }

                    client_conn.write('HTTP/1.1 401 UNAUTHORIZED\r\n');
                    client_conn.write('Content-Length: 0\r\n\r\n');
                    client_request = {};
                    return;
                });

                device_conn.on('data', function (data) {
                    if (authorized) {
                        client_conn.write(data);
                        return;
                    }
                });

                client_conn.on('close', function (had_error) {
                    console.log('client ' + [device_id, client_id].join(':') + ' disconnected');

                    client_sockets[client_id] = false;
                });
            });

            client_server.listen(function () {
                var port = String(client_server.address().port);

                console.log('client server listening on port ' + port + ' for device ' + device_id);

                device_conn.write('HTTP/1.1 200 OK\r\n');
                device_conn.write('Content-Type: application/json\r\n');
                device_conn.write('Content-Length: ' + (port.length + 18) + '\r\n\r\n');
                device_conn.write('{"client_port":"' + port + '"}');
            });

            device_request = {};
            return;
        }

        device_conn.write('HTTP/1.1 400 BAD REQUEST\r\n');
        device_conn.write('Content-Length: 0\r\n\r\n');
        device_request = {};
        return;
    });

    device_conn.on('close', function (had_error) {
        console.log('device ' + device_id + ' disconnected');

        device_sockets[device_id] = false;

        for (var i = 0; i < client_sockets.length; i++) {
            if (client_sockets[i])
                client_sockets[i].destroy();
        }
    });
});

device_server.listen(3000, function () {
    console.log('device server listening on port ' + device_server.address().port);
});
