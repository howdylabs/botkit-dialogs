var debug = require('debug')('botkit:cms');
var async = require('async');

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

  var testTrigger = function(trigger, message) {
    return new Promise(function(resolve, reject) {
      if (botkit.ears[trigger.type]) {
        botkit.ears[trigger.type](
          {
            type: trigger.type,
            pattern: trigger.pattern,
          },
          message
        ).then(resolve).catch(reject);
      } else {
        reject(new Error('Missing test type' +  condition.type));
      }
    });
  }

    var trigger_schema = {
      type: String, // maps to a type of ears
      pattern: String, // contains the pattern to match against if needed
      script: {
        type: botkit.db.schema.Types.ObjectId,
        rel: 'scripts',
        index: true,
      },
      created: {
          type: Date,
          default: Date.now,
      },
      modified: {
          type: Date,
          default: Date.now,
      },
    }



    return {
        name: 'Dialog Manager',
        web: [{
                url: '/admin/cms',
                method: 'get',
                handler: function(req, res) {
                    res.render(botkit.localView(__dirname + '/views/list'));
                }
            },
            {
                url: '/admin/cms/triggers',
                method: 'get',
                handler: function(req, res) {
                    res.render(botkit.localView(__dirname + '/views/triggers'));
                }
            },
            {
                url: '/admin/cms/:script',
                method: 'get',
                handler: function(req, res) {
                    res.render(botkit.localView(__dirname + '/views/detail'));
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
                    botkit.db.scripts.update({_id: {$in: list}},{$set:{deleted: true}},{multi: 1}, function(err, results) {
                      if (err) {
                        res.json({ok:false});
                      } else {
                        res.json({ok:true});
                      }
                    });
                }
            },
            {
                url: '/admin/api/scripts/backlinks',
                method: 'get',
                handler: function(req, res) {
                    var thread = req.query.thread;
                    var script = req.query.script;

                    // TODO: Switch this to use script_id

                    var params = {
                      '$or':[
                        {
                          'threads.messages': {
                            $elemMatch: {
                              'options.thread': thread,
                              'options.script': script
                            },
                          },
                        },
                        {
                          'threads.messages.branches': {
                            $elemMatch: {
                              'options.thread': thread,
                              'options.script': script
                            },
                          },
                        },
                        {
                          'command': script,
                          'threads.messages': {
                            $elemMatch: {
                              'options.thread': thread,
                              'options.script': {$exists: false}
                            },
                          },
                        },
                        {
                          'command': script,
                          'threads.messages.branches': {
                            $elemMatch: {
                              'options.thread': thread,
                              'options.script': {$exists: false}
                            },
                          },
                        }
                      ]
                    }

                    var query = botkit.db.scripts.find(params);

                    console.log('QUERY', JSON.stringify(params,null,2));
                    query.exec(function(err,scripts) {
                      if (err) {
                        console.error(err);
                        res.json(err);
                      } else {
                        res.json(scripts);
                      }
                    })

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
                            modified: new Date(),
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
            },

/* trigger management */
            {
                url: '/admin/api/triggers',
                method: 'get',
                handler: function(req, res) {

                    var params = {
                    };

                    if (req.query.script) {
                      params['script'] = req.query.script;
                    }

                    var query = botkit.db.triggers.find(params).sort({
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
                url: '/admin/api/triggers/delete',
                method: 'post',
                handler: function(req, res) {
                    var list = req.body;
                    console.log('DELETE LIST', list);
                    botkit.db.triggers.remove({_id: {$in: list}}, function(err, results) {
                      if (err) {
                        res.json({ok:false});
                      } else {
                        res.json({ok:true});
                      }
                    });
                }
            },
            {
                url: '/admin/api/triggers/:id',
                method: 'get',
                handler: function(req, res) {
                    var query = botkit.db.triggers.findOne({
                        _id: req.params.id,
                    });
                    query.exec(function(err, human) {
                        res.json(human);
                    });
                }
            },
            {
                url: '/admin/api/triggers/:id',
                method: 'post',
                handler: function(req, res) {
                    var trigger = req.body;
                    var query = botkit.db.triggers.update({
                        _id: trigger._id
                    }, {
                        $set: {
                            // command: script.command,
                            // threads: script.threads,
                            modified: new Date(),
                        }
                    });

                    query.exec(function(err) {
                        res.json(script);
                    })

                }
            },
            {
                url: '/admin/api/triggers',
                method: 'post',
                handler: function(req, res) {

                    var new_trigger = req.body;

                    var trigger = new botkit.db.triggers();
                    trigger.script = new_trigger.script;
                    trigger.type = new_trigger.type;
                    trigger.pattern = new_trigger.pattern;

                    trigger.save(function(err, trigger) {
                        res.json(trigger);
                    });

                    console.log('NEW SCRIPT', new_trigger);
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
            icon: '<img src="/icons/list.png">',
        }],
        middleware: {
            understand: [function(bot, message, response, next) {
                debug('Evaluate ', message);
                if (response.script) {
                    debug('Skipping db triggers');
                    return next();
                }

                // load all the triggers out of the db
                botkit.db.triggers.find({}, function(err, triggers) {
                  if (err) {
                    console.error('Error loading triggers', err);
                    return next(err);
                  }

                  // TODO: consider sorting or prioritizing the triggers somehow
                  var triggered = false;
                  async.each(triggers, function(trigger, nextTrigger) {
                    if (!triggered) {
                      testTrigger(trigger, message).then(function(passed) {
                          if (passed) {
                            triggered = trigger.script;
                            nextTrigger();
                          } else {
                            nextTrigger();
                          }
                      }).catch(nextTrigger)
                    } else { nextTrigger(); }
                  },function(err) {
                    if (triggered) {
                      botkit.db.scripts.findOne({deleted: {$ne:true}, _id: triggered}, function(err, script) {
                        if (script) {
                          response.script = script;
                          response.state = {
                            thread: 'default',
                            cursor: 0,
                            turn: 0,
                          }
                        } else {
                          console.error('Triggered a non-existing script');
                        }
                        next();
                      });
                    } else {
                      next();
                    }
                  });
                });
            }],
        },
        init: function(botkit) {
            botkit.db.addModel(script_schema, 'script', 'scripts');
            botkit.db.addModel(trigger_schema, 'trigger', 'triggers');

            botkit.publicFolder("/plugins/cms", __dirname + "/public");

            botkit.addAction('say', 'Say something', 'Say <span class="utterance">{% action.options.text %}</span>', '/plugins/cms/actions/say.html', function(convo, message) {
              return new Promise(function(resolve, reject) {
                console.log('DOING SAY ACTION');
                var msg = convo.processTemplate({
                  text: message.options.text
                });
                console.log('inserting',msg);
                try {
                  convo.replies.push(msg);
                } catch(err) {
                  console.error('ERROR',err);
                }
                console.log('INSERTED A MESSAGE!');
                resolve();
              });
            });


            botkit.addAction('code', 'Execute Function', 'Exec <span class="utterance">{% action.options.function %}</span>', '/plugins/cms/actions/function.html', function(convo, message) {
              return new Promise(function(resolve, reject) {
                console.log('RUNNING CODE');
                var func;
                try {
                  // wrap code in a closure so it comes back as an executable function
                  func = eval("("+message.options.code+")");
                } catch(err) {
                  console.error('Error in custom code plugin');
                  console.error(message.options.code);
                  console.error(err);
                  return reject(err);
                }

                console.log(func);

                try {
                  func(convo, message, function() {
                      resolve();
                  });
                } catch(err) {
                  reject(err);
                }
              });
            });

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
