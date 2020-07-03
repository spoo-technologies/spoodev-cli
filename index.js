#!/usr/bin/env node

const axios = require("axios");
const program = require('commander');
var LocalStorage = require('node-localstorage').LocalStorage;
var localStorage = new LocalStorage('./data');
var fs = require('fs');
var FormData = require('form-data');
var archiver = require('archiver');
var archive = archiver('zip');
var shortid = require('shortid');

const zipFolder = require('zip-a-folder');

const followRedirects = require('follow-redirects');
followRedirects.maxRedirects = 10;
followRedirects.maxBodyLength = 50 * 1024 * 1024;

const cli = {
    push: function(app, archive, host, callback) {

        this.authenticated(localStorage.getItem('clientId'), function(data, err) {
            if (err) {
                console.log(data);
                console.log("Not authenticated");
                return;
            }

            console.log("Authentication ok");
            console.log("uploading archive");

            var form_data = new FormData();
            form_data.append("archive", fs.createReadStream(archive));

            axios({
                    method: "post",
                    url: (host || 'https://spoo.app') + '/webhosting/upload/client/' + localStorage.getItem('clientId') + '/app/' + app + '?token=' + localStorage.getItem('accessToken'),
                    headers: form_data.getHeaders(),
                    data: form_data,

                })
                .then(response => {
                    if (response.status == 200) callback(response.data, false);
                    else error(false);
                })
                .catch(err => {
                    callback(err, true);
                });

        })
    },

    compress: function(app, dir, host, callback) {

        var tmpName = shortid.generate();

        zipFolder.zipFolder(dir, '/tmp/' + tmpName + '.zip', function(err) {
            if (err) {
                console.log('Something went wrong!', err);
            }

            cli.push(app, '/tmp/' + tmpName + '.zip', host, function(data, err) {
                if (err) {
                    console.log(data);
                    fs.unlinkSync('/tmp/' + tmpName + '.zip');
                    callback(data, true);
                    return;
                }
                fs.unlinkSync('/tmp/' + tmpName + '.zip');
                callback(data, false)
            });
        });
    },

    authenticated: function(client, callback) {
        axios.get('https://spoo.io/api/client/' + client + '/authenticated?token=' + localStorage.getItem('accessToken'))
            .then(response => {
                if (response.status == 200) callback(response.data, false);
                else error(false);
            })
            .catch(err => {
                callback(err.response.data, true);
            });
    },

    auth: function(client, app, username, password, host, callback) {
        axios.post('https://spoo.io/api/client/' + client + '/app/' + app + '/auth', {
                username: username,
                password: password
            })
            .then(response => {
                if (response.status == 200) callback(response.data, false);
                else error(false);
            })
            .catch(err => {
                callback(err.response.data, true);
            });
    },

    check_app: function(app, host, callback) {
        axios.get( (host || 'https://spoo.app') +'/webhosting/check_app/' + app)
            .then(response => {
                if (response.status == 200) callback(response.data, false);
                else error(false);
            })
            .catch(err => {
                callback(err.response.data, true);
            });
    }
}

program
    .command('push <type>')
    .alias('p')
    .option('-z, --zip [value]')
    .option('-a, --app [value]')
    .option('-d, --directory [value]')
    .option('-h, --host [value]')
    .description('Push your app')
    .action(function(type, args) {

        switch (type) {
            case 'arch':
                cli.push(args.app, args.zip, args.host, function(data, err) {
                    if (err) {
                        console.log("Upload failed");
                        console.log(data);
                        return;
                    }
                    console.log(data);
                });
                break;
            case 'dir':
                cli.compress(args.app, args.directory, args.host, function(data, err) {
                    if (err) {
                        console.log("Upload failed");
                        console.log(data);
                        return;
                    }
                    console.log(data);
                });
                break;
        }
    });

program
    .command('login')
    .alias('l')
    .option('-u, --username [value]')
    .option('-p, --password [value]')
    .option('-c, --client [value]')
    .option('-a, --app [value]')
    .option('-h, --host [value]')
    .description('Login to your SPOO Cloud Workspace')
    .action(function(args) {


        cli.auth(args.client, args.app, args.username, args.password, args.host, function(data, err) {
            if (err) {
                console.log("Login failed");
                console.log(data);
                return;
            }

            console.log("Authenticated!");

            localStorage.setItem('clientId', args.client);
            localStorage.setItem('accessToken', data.token.accessToken);
            localStorage.setItem('refreshToken', data.token.refreshToken)
        });

    });

program
    .command('app <app>')
    .alias('a')
    .option('-h, --host [value]')
    .description('Check if an app is published')
    .action(function(app, args) {

        cli.check_app(app, args.host, function(data, err) {
            if (err) {

                console.log(data);
                return;
            }
            console.log(data);
        });

    });

program.parse(process.argv);