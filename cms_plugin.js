var express = require('express');
var path = require('path');
var debug = require('debug')('botkit:cms');
const CURRENT_SCRIPT_VERSION = 2;

var script_schema = {
    version: String,
    command: String,
    threads: [{}],
    created: {
        type: Date,
        default: Date.now,
    },
    modified: {
        type: Date,
        default: Date.now,
    },
    deleted: {
      type: Boolean,
      default: false,
    }
}

module.exports = function(botkit) {
    return {
        name: 'Dialog Manager',
        web: [{
                url: '/admin/cms',
                method: 'get',
                handler: function(req, res) {
                    var relativePath = path.relative(process.cwd() + '/views', __dirname + '/views');
                    res.render(relativePath + '/list');
                }
            },
            {
                url: '/admin/cms/:script',
                method: 'get',
                handler: function(req, res) {
                    var relativePath = path.relative(process.cwd() + '/views', __dirname + '/views');
                    res.render(relativePath + '/detail');
                }
            },
            {
                url: '/admin/api/cms/config',
                method: 'get',
                handler: function(req, res) {
                    res.json({
                        ears: botkit.earsList,
                        actions: botkit.actions
                    });
                }
            },
            {
                url: '/admin/api/scripts',
                method: 'get',
                handler: function(req, res) {

                    var params = {
                      deleted: {$ne: true},
                    };
                    if (req.query.q) {
                        // search name at least
                        params['$or'] = [{
                            'command': new RegExp(req.query.q, 'i'),
                        }]

                        if (req.query.topics) {
                            params['$or'].push({
                                'threads': {
                                    $elemMatch: {
                                        topic: new RegExp(req.query.q, 'i')
                                    }
                                }
                            })
                        }

                        if (req.query.text) {
                            params['$or'].push({
                                'threads.messages': {
                                    $elemMatch: {
                                        text: new RegExp(req.query.q, 'i')
                                    }
                                }
                            })
                        }

                    }

                    var query = botkit.db.scripts.find(params).sort({
                        modified: -1
                    });

                    if (req.query.limit) {
                        query.limit(parseInt(req.query.limit));
                    }
                    if (req.query.skip) {
                        query.skip(parseInt(req.query.skip));
                    }

                    query.exec(function(err, scripts) {
                        if (err) {
                            res.json(err);
                        } else {
                            res.json(scripts);
                        }
                    });
                }
            },
            {
                url: '/admin/api/scripts/delete',
                method: 'post',
                handler: function(req, res) {
                    var list = req.body;
                    console.log('DELETE LIST', list);
                    botkit.db.scripts.update({_id: {$in: list}},{$set:{deleted: true}},{$multi: 1}, function(err, results) {
                      if (err) {
                        res.json({ok:false});
                      } else {
                        res.json({ok:true});
                      }
                    });
                }
            },
            {
                url: '/admin/api/scripts/:id',
                method: 'get',
                handler: function(req, res) {
                    var query = botkit.db.scripts.findOne({
                        _id: req.params.id,
                        deleted: {$ne: true},
                    });
                    query.exec(function(err, human) {
                        res.json(human);
                    });
                }
            },
            {
                url: '/admin/api/scripts/:id',
                method: 'post',
                handler: function(req, res) {
                    var script = req.body;
                    var query = botkit.db.scripts.update({
                        _id: script._id
                    }, {
                        $set: {
                            command: script.command,
                            threads: script.threads,
                            modifed: new Date(),
                        }
                    });

                    query.exec(function(err) {
                        res.json(script);
                    })

                }
            },
            {
                url: '/admin/api/scripts',
                method: 'post',
                handler: function(req, res) {

                    var new_script = req.body;

                    var script = new botkit.db.scripts();
                    script.command = new_script.command;
                    script.version = new_script.version || CURRENT_SCRIPT_VERSION;
                    script.threads = new_script.threads;

                    script.save(function(err, script) {
                        res.json(script);
                    });

                    console.log('NEW SCRIPT', new_script);
                    // var query = botkit.db.scripts.findOne({id: req.params.id});
                    // query.exec(function(err, human) {
                    //     res.json(human);
                    // });
                }
            }
        ],
        menu: [{
            title: 'Dialogs',
            url: '/admin/cms',
            icon: '📚',
        }],
        middleware: {
            understand: [function(bot, message, response, next) {
                debug('Evaluate ', message);
                if (response.script) {
                    debug('Skipping db triggers');
                    return next();
                }

                // TODO: can do this with some more sublety
                botkit.db.scripts.find({deleted: {$ne: true}}, function(err, scripts) {

                    if (err) {
                        console.log('Error loading scripts', err);
                        return next(err);
                    }

                    // TODO: this is fake
                    // need to compile triggers and test them all

                    for (var s = 0; s < scripts.length; s++) {
                        if (message.text == scripts[s].command) {
                            debug('MATCHED A TRIGGER');
                            response.script = scripts[s];
                            response.state = {
                                thread: 'default',
                                cursor: 0,
                                turn: 0,
                            }
                        }
                    }

                    next();
                });
            }],
        },
        init: function(botkit) {
            botkit.db.addModel(script_schema, 'script', 'scripts');

            botkit.webserver.use("/plugins/cms", express.static(__dirname + "/public"));

            botkit.addAction('execute', 'Execute Script', '<i class="fa fa-arrow-circle-right" aria-hidden="true"></i> Go to <span class="branch-title" ng-click="followOption(action.options, $event)">{% action.options.script %}:{% action.options.thread %}</span>', '/plugins/cms/actions/execute_script.html', function(convo, message) {
                return new Promise(function(resolve, reject) {
                    console.log('exec a script', message);

                    botkit.db.scripts.findOne({
                        _id: message.options.script_id,
                        deleted: {$ne: true},
                    }, function(err, script) {

                        if (err) {
                            return reject(err);
                        } else if (!script) {
                          return reject(new Error('Script not found'));
                        } else if (script) {

                            botkit.middleware.afterScript.run(convo, function(err, convo) {

                                convo.state.transition_from = convo.script.command;

                                // reset script and state
                                convo.state.cursor = 0;
                                convo.state.thread = 'default';
                                convo.ingestScript(script).then(function() {
                                    if (message.options.thread && message.options.thread != 'default') {
                                        convo.kickoff(true).then(function() {
                                            convo.gotoThread(message.options.thread).then(resolve).catch(reject)
                                        }).catch(reject);
                                    } else {
                                        // call any before things
                                        convo.kickoff(true).then(resolve).catch(reject);
                                    }
                                }).catch(reject);

                            });
                        }
                    });
                });
            });


            botkit.addAction('gotothread', 'Go to Thread','<i class="fa fa-arrow-circle-right" aria-hidden="true"></i> Go to <span class="branch-title" ng-click="followOption(action.options, $event)">{% action.options.thread %}</span>','/plugins/cms/actions/gotothread.html', function(convo, message) {
                return new Promise(function(resolve, reject) {
                    convo.gotoThread(message.options.thread).then(resolve).catch(reject);
                });
            });

        }
    }
}
