app.controller('triggersController', ['$scope', function($scope) {

    $scope.ui.type = 'string';

    $scope.ui.groups = {};

    $scope.deleteTriggers = function() {
        //      var list = $scope.ui.triggers.filter(function(s) { return s.$$selected }).map(function(s) { return s._id });
        var list = [];
        for (var group in $scope.ui.groups) {
            for (var t = 0; t < $scope.ui.groups[group].triggers.length; t++) {
                console.log($scope.ui.groups[group].triggers[t]);
                if ($scope.ui.groups[group].triggers[t].$$selected) {
                    list.push($scope.ui.groups[group].triggers[t]);
                }
            }
        }
        console.log('DELETE TRIGGERS', list);
        if (list.length > 0) {
            var q = (list.length == 1) ? 'Delete this trigger?' : 'Delete ' + list.length + ' triggers?';
            $scope.confirm(q).then(function() {
                $scope.request({
                    method: 'post',
                    url: '/admin/api/triggers/delete',
                    data: list,
                }).then(function(res) {
                    $scope.loadTriggers();
                    // console.log('got scripts:', scripts);
                    // $scope.ui.scripts = scripts;
                    // $scope.$apply();
                }).catch($scope.handleError);
            }).catch(function() {});
        }
    }

    $scope.updateGroups = function() {

        $scope.ui.groups = {};

        // sort most recent to top
        $scope.ui.triggers = $scope.ui.triggers.sort(function(a, b) {
            if (new Date(a.modified) > new Date(b.modified)) {
                return -1
            };
            if (new Date(a.modified) < new Date(b.modified)) {
                return 1
            };
            return 0;
        });

        for (var t = 0; t < $scope.ui.triggers.length; t++) {
            var trigger = $scope.ui.triggers[t];
            if ($scope.ui.groups[trigger.script]) {
                $scope.ui.groups[trigger.script].triggers.push(trigger);
            } else {
                $scope.ui.groups[trigger.script] = {
                    triggers: [trigger],
                    script: $scope.ui.scripts.filter(function(s) {
                        return s._id == trigger.script
                    })[0]
                }
            }
        }
        $scope.$apply();

    }

    $scope.addTrigger = function() {

        var new_trigger = {
            type: $scope.ui.type,
            pattern: $scope.ui.pattern,
            script: $scope.ui.action,
            modified: new Date(),
        }

        if (new_trigger.type && new_trigger.script && new_trigger.pattern) {

            $scope.request({
                method: 'post',
                url: '/admin/api/triggers',
                data: new_trigger,
            }).then(function(res) {
                $scope.ui.triggers.push(new_trigger);
                $scope.ui.pattern = '';
                $scope.updateGroups();
            }).catch(function(err) {
                console.error(err);
            });
        }

    }

    console.log('Booted trigger controller');
    $scope.$on('scripts_loaded', function() {
        $scope.loadTriggers();
    });

    $scope.loadTriggers = function(script) {
        $scope.request({
            method: 'get',
            url: '/admin/api/triggers',
            data: {
                script: script,
            }
        }).then(function(triggers) {
            console.log('Got triggers', triggers);
            $scope.ui.triggers = triggers;
            $scope.request({
                method: 'get',
                url: '/admin/api/cms/config',
            }).then(function(res) {
                $scope.ui.available_tests = res.ears;
                console.log('got ears', res.ears);
                $scope.updateGroups();
                $scope.$apply();
            });

        });
    }


}]);


app.controller('view_scripts', ['$scope', function($scope) {
    console.log('BOOTED scriptS CONTROLLER');
    $scope.ui.transcripts = [];

    $scope.isOneSided = function(type) {
        if ($scope.ui.available_tests) {
            // find action
            var ears = $scope.ui.available_tests.filter(function(a) {
                return (a.type == type);
            });

            if (ears.length) {
                return ears[0].options.one_sided;
            } else {
                return false;
            }
        } else return false;

    }

    $scope.describeTest = function(opts) {
        var txt = '';
        if (opts.type) {
            var tests = $scope.ui.available_tests.filter(function(a) {
                return a.type == opts.type
            });
            if (tests.length) {
                txt = tests[0].description;
            } else {
                txt = opts.type;
            }
        }
        return txt;
    }

    $scope.deleteScripts = function() {
        var list = $scope.ui.scripts.filter(function(s) {
            return s.$$selected
        }).map(function(s) {
            return s._id
        });
        if (list.length > 0) {
            var q = (list.length == 1) ? 'Delete this script?' : 'Delete ' + list.length + ' scripts?';
            $scope.confirm(q).then(function() {
                $scope.request({
                    method: 'post',
                    url: '/admin/api/scripts/delete',
                    data: list,
                }).then(function(res) {
                    $scope.loadScripts();
                    // console.log('got scripts:', scripts);
                    // $scope.ui.scripts = scripts;
                    // $scope.$apply();
                }).catch($scope.handleError);
            }).catch(function() {});
        }
    }

    $scope.search = function() {

        var limit = 5;
        $scope.request({
            method: 'get',
            url: '/admin/api/scripts',
            params: {
                q: $scope.ui.search,
                limit: limit || 5,
                topics: true,
                text: true
            }
        }).then(function(scripts) {
            $scope.ui.scripts = scripts;
            $scope.$apply();
        });
    }


    $scope.loadScripts = function(limit) {
        $scope.request({
            method: 'get',
            url: '/admin/api/scripts',
            params: {
                limit: limit,
            }
        }).then(function(scripts) {
            console.log('got scripts:', scripts);
            $scope.ui.scripts = scripts;
            $scope.$broadcast('scripts_loaded');
            $scope.$apply();
        }).catch($scope.handleError);
    }

    $scope.isUnique = function(title) {
        return ($scope.ui.scripts.filter(function(s) {
            return s.command.toLowerCase() == title.toLowerCase()
        }).length == 0);
    }

    $scope.saveScript = function(script) {
        return $scope.request({
            method: 'post',
            url: '/admin/api/scripts/' + script._id,
            data: script,
        });
    }

    $scope.renameScript = function(script, error) {

        var val = script.command;
        $scope.bigInput('Rename this script', 'Descriptive title for your new script', val, 'Rename', error).then(function(title) {
            if ($scope.isUnique(title)) {
                script.command = title;
                $scope.saveScript(script).then($scope.loadScripts).catch($scope.handleError);
            } else {
                console.log('NAME ALREADY IN USE!');
                $scope.renameScript(script, 'This title is already in use.');
                $scope.$apply();
            }
        }).catch(function() {});
    }

    $scope.cloneScript = function(script) {
        $scope.confirm('Duplicate this script?').then(function() {

            // generate new name
            var topic = script.command;
            var counter = 2;
            while (!$scope.isUnique(topic + " " + counter)) {
                counter++;
            }
            var obj = angular.copy(script);
            delete(script._id);
            obj.command = topic + ' ' + counter;
            $scope.request({
                method: 'post',
                url: '/admin/api/scripts',
                data: obj
            }).then(function() {
                $scope.loadScripts();
            }).catch($scope.handleError);
        });
    }

    $scope.deleteScript = function(script) {
        $scope.confirm('Delete this script?').then(function() {
            $scope.request({
                method: 'post',
                url: '/admin/api/scripts/delete',
                data: [script._id],
            }).then(function(res) {
                $scope.loadScripts();
            }).catch($scope.handleError);
        }).catch(function() {});

    }


    $scope.newScript = function(error, val) {
        $scope.bigInput('Create a new sequence of messages and actions for your bot', 'Descriptive title for your new script', val, 'Create', error).then(function(title) {
            if ($scope.isUnique(title)) {
                $scope.request({
                    method: 'post',
                    url: '/admin/api/scripts',
                    data: {
                        version: 2,
                        command: title,
                        threads: [{
                            topic: 'default',
                            messages: [{
                                text: [
                                    'This is the "' + title + '" script',
                                ]
                            }],
                        }],
                    }
                }).then(function() {
                    $scope.loadScripts();
                }).catch($scope.handleError);
            } else {
                return $scope.newScript('This title is already in use.', title)
            }
        }).catch(function() {});
    }

    $scope.loadScripts();

}]);


// src: https://stackoverflow.com/questions/19726179/how-to-make-ng-bind-html-compile-angularjs-code
app.directive('bindHtmlCompile', ['$compile', function($compile) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            scope.$watch(function() {
                return scope.$eval(attrs.bindHtmlCompile);
            }, function(value) {
                element.html(value);
                $compile(element.contents())(scope);
            });
        }
    };
}]);

app.controller('messageActionController', ['$scope', function($scope) {
    $scope.init = function(info) {
        $scope.action = info;
    }
}]);


app.controller('view_script', ['$scope', '$sce', '$compile', 'clipboard', function($scope, $sce, $compile, clipboard) {

    $scope.ui.messages = [];
    $scope.ui.current_thread = '';
    $scope.ui.dirty = false;
    $scope.ui.showLogic = true;
    
    $scope.markDirty = function() {
      $scope.ui.dirty = true;
    }

    $scope.isOneSided = function(type) {
        if ($scope.ui.available_tests) {
            // find action
            var ears = $scope.ui.available_tests.filter(function(a) {
                return (a.type == type);
            });

            if (ears.length) {
                return ears[0].options.one_sided;
            } else {
                return false;
            }
        } else return false;

    }

    $scope.loadTriggers = function(script) {
        $scope.request({
            method: 'get',
            url: '/admin/api/triggers?script=' + script,
        }).then(function(triggers) {
            console.log('Got triggers', triggers);
            $scope.ui.triggers = triggers;
            $scope.$apply();

        });
    }

    $scope.describeTest = function(opts) {
        var txt = '';
        if (opts.type) {
            var tests = $scope.ui.available_tests.filter(function(a) {
                return a.type == opts.type
            });
            if (tests.length) {
                txt = tests[0].description;
            } else {
                txt = opts.type;
            }
        }
        return txt;
    }
    $scope.followOption = function(opts, $event) {
        $event.stopPropagation();

        // TODO: FINISH THIS
        if (opts.thread && !opts.script) {
            $scope.selectThread(opts.thread);
        }
        if (opts.thread && opts.script==$scope.ui.script.command) {
            $scope.selectThread(opts.thread);
        }

        console.log('FOLLOW OPTION', opts);

    }




    $scope.getMessageAction = function(opts) {
        var txt = '';
        if (opts.action) {
            var actions = $scope.ui.available_actions.filter(function(a) {
                return a.type == opts.action
            });
            if (actions.length) {
                txt = actions[0].template;
            } else {
                txt = opts.action;
            }
        }
        return txt;
    }




    $scope.describeAction = function(opts) {
        var txt = '';
        if (opts.action) {
            var actions = $scope.ui.available_actions.filter(function(a) {
                return a.type == opts.action
            });
            if (actions.length) {
                txt = actions[0].description;
            } else {
                txt = opts.action;
            }
        }
        return txt;
    }

    $scope.request({
        method: 'get',
        url: '/admin/api/cms/config',
    }).then(function(res) {
        $scope.ui.available_tests = res.ears;
        $scope.ui.available_actions = res.actions;
        if (uid = window.location.href.match(/.*\/cms\/(.*)/)) {
            uid = uid[1];

            $scope.request({
                method: 'get',
                url: '/admin/api/scripts/' + uid
            }).then(function(script) {
                console.log('got script:', script);
                $scope.ui.script = script;
                $scope.selectThread('default');
                $scope.loadTriggers($scope.ui.script._id);
                $scope.$apply();

            }).catch($scope.handleError);

        }

    }).catch($scope.handleError);



    $scope.$watch('ui.current_condition.action', function(value) {
        if (!value) {
            return;
        }

        // find action
        var actions = $scope.ui.available_actions.filter(function(a) {
            return (a.type == value);
        })

        var widget_url = null;

        if (actions.length) {
            if (actions[0].template) {
                widget_url = actions[0].widget_url;
            }
        }


        $scope.ui.widget_url = widget_url;

    });

    $scope.generateActionClass = function(action) {

        switch (action) {
            case 'next':
            case 'stop':
            case 'timeout':
            case 'repeat':
            case 'wait':
            case 'complete':
            case 'execute_script':
                return action;
            default:
                return '';
        }

    }

    $scope.selectThread = function(thread) {

        console.log('selecting thread', thread);
        var desired_thread = $scope.ui.script.threads.filter(function(t) {
            return (t.topic == thread);
        })

        if (desired_thread.length) {
            $scope.ui.current_thread = desired_thread[0];
        }

        $scope.getBacklinks($scope.ui.script.command, thread);

    }

    $scope.getBacklinks = function(script, thread) {
        $scope.request({
            method: 'get',
            url: '/admin/api/scripts/backlinks?thread=' + thread + '&script=' + script
        }).then(function(backlink_scripts) {
            var backlinks = [];

            backlink_scripts.map(function(s) {
                s.threads.map(function(t) {
                    t.messages.map(function(message) {
                      var link = {
                          // script: s.command,
                          thread: t.topic
                      };
                      // include scrip if it is not local
                      if (s.command != $scope.ui.script.command) {
                        link.script = s.command;
                      }

                        if (message.action == 'execute' && message.options.thread == thread && message.options.script == script) {
                          if (backlinks.indexOf(link) < 0) {
                            backlinks.push(link);
                          }
                        }
                        if (message.action == 'gotothread' && message.options.thread == thread && s.command == script) {
                          if (backlinks.indexOf(link) < 0) {
                            backlinks.push(link);
                          }
                        }

                        if (message.branches) {
                            message.branches.map(function(branch) {
                                if (branch.action == 'execute' && branch.options.thread == thread && branch.options.script == script) {
                                  if (backlinks.indexOf(link) < 0) {
                                    backlinks.push(link);
                                  }
                                }
                                if (branch.action == 'gotothread' && branch.options.thread == thread && s.command == script) {
                                  if (backlinks.indexOf(link) < 0) {
                                    backlinks.push(link);
                                  }
                                }
                            });
                        }
                    });
                });
            });
            $scope.ui.backlinks = backlinks;
            $scope.$apply();
        });

    }

    $scope.isUniqueThread = function(title) {
        return ($scope.ui.script.threads.filter(function(t) {
            return t.topic.toLowerCase() == title.toLowerCase()
        }).length == 0);
    }

    $scope.newThread = function(err, val) {

        $scope.bigInput('Add a thread', 'Descriptive name of this thread', val, 'Create', err).then(function(title) {
            if ($scope.isUniqueThread(title)) {
                console.log('ADDING NEW THREAD', title);
                var text = 'This is the ' + title + ' thread';

                $scope.ui.script.threads.push({
                    topic: title,
                    messages: [{
                        text: [text]
                    }]
                });

                $scope.markDirty();
                $scope.selectThread(title);
                $scope.$apply();

            } else {
                $scope.newThread('This thread name is already in use', title);
                $scope.$apply();
            }
        }).catch(function() {});

    }

    $scope.render = function(message) {

        var text;
        if (Array.isArray(message.text)) {
            text = message.text[0];
        } else {
            text = message.text;
        }

        // TODO: render markdown!

        return $sce.trustAsHtml(text);
    }

    $scope.addMessage = function(blank) {
        if (blank) {
            $scope.ui.current_thread.messages.push({
                text: ['Edit me']
            });
        } else if ($scope.ui.new_message) {
            $scope.ui.current_thread.messages.push({
                text: [$scope.ui.new_message]
            });

            $scope.ui.new_message = '';
        }
    }

    $scope.addAction = function() {
        $scope.ui.current_thread.messages.push({
            action: 'next',
        });
    }

    $scope.logScript = function() {
        console.log($scope.ui.script);
    }

    //override this
    $scope.openDialog = function(template_path) {
        console.log('LOAD DIALOG', template_path);
        $scope.ui.edit_dialog_template = template_path;
        $scope.ui.edit_dialog_open = true;

        $scope.esckey = $scope.$on('escape_key', function() {
          console.log('HEARD ESCAPE KEY');
          $scope.closeDialog();
          $scope.$apply();
        });
    }

    $scope.closeDialog = function(event) {
        if (event) { event.stopPropagation(); }
        $scope.esckey();
        $scope.ui.edit_dialog_open = false;
        $scope.ui.edit_dialog_template = null;
    }

    $scope.editMessage = function(message) {
        if (message.action) {
            delete($scope.ui.current_message);
            $scope.ui.current_condition = message;
            $scope.openDialog('/plugins/cms/edit_condition.html');
        } else {
            $scope.ui.current_message = message;
            $scope.openDialog('/plugins/cms/message_detail.html');
        }
    }

    $scope.save = function() {

        var script = JSON.parse(angular.toJson($scope.ui.script));

        $scope.request({
            method: 'post',
            url: '/admin/api/scripts/' + $scope.ui.script._id,
            data: script,
        }).then(function(res) {
          $scope.ui.dirty = false;
          $scope.$apply();
        }).catch($scope.handleError);

    }


    window.onbeforeunload = function() {
        if ($scope.ui.dirty) {
            return 'dirty';
        }
    }

    document.addEventListener('paste', function(event) {
        var clipText = event.clipboardData.getData('Text');
        var obj = null;

        try {
            obj = JSON.parse(clipText);
        } catch (err) {
            return;
        }

        if (obj) {
            if (obj.$$copied_object_type == 'message') {
                $scope.cloneMessage(obj);
                $scope.$apply();
            }
            if (obj.$$copied_object_type == 'thread') {
                $scope.cloneThread(obj);
                $scope.$apply();
            }

        }
    });

    $scope.cloneThread = function(thread) {
        // generate new name
        var topic = thread.topic;
        var counter = 2;
        while (!$scope.isUniqueThread(topic + " " + counter)) {
            counter++;
        }
        var obj = angular.copy(thread);
        obj.topic = topic + ' ' + counter;
        $scope.ui.script.threads.push(obj);
        $scope.markDirty();
    }

    $scope.copyThread = function(thread) {
        var obj = angular.copy(thread);
        obj.$$copied_object_type = 'thread';
        clipboard.copyText(JSON.stringify(obj));
    }


    $scope.renameThread = function(thread, err) {
        var topic = thread.topic;
        $scope.bigInput('Rename this thread', 'Descriptive name of this thread', topic, 'Update', err).then(function(title) {
            if ($scope.isUniqueThread(title)) {
                thread.topic = title;
                $scope.selectThread(title);
                $scope.markDirty();
                $scope.$apply();
            } else {
                $scope.renameThread(thread, 'This thread name is already in use');
                $scope.$apply();
            }
        }).catch(function() {});
    }

    $scope.deleteThread = function($index) {
        $scope.confirm('Delete this thread?').then(function() {
            $scope.ui.script.threads.splice($index, 1);
            $scope.selectThread($scope.ui.script.threads[$index - 1].topic);
            $scope.markDirty();
        })
    }

    $scope.cloneMessage = function(message) {
        $scope.ui.current_thread.messages.push(angular.copy(message));
        $scope.markDirty();
    }

    $scope.copyMessage = function(message) {
        var obj = angular.copy(message);
        obj.$$copied_object_type = 'message';
        clipboard.copyText(JSON.stringify(obj));
    }


    $scope.deleteMessage = function($index) {
        $scope.confirm('Delete this message?').then(function() {
            $scope.ui.current_thread.messages.splice($index, 1);
            $scope.markDirty();
        })
    }

}]);


app.controller('message_detail', ['$scope', function($scope) {

    $scope.ui.text_version = 0;

    $scope.deleteBranches = function() {
        if (confirm('Delete selected items?')) {

            $scope.ui.current_message.branches = $scope.ui.current_message.branches.filter(function(b) {
                return (!b.$$selected);
            });

            if ($scope.ui.current_message.branches.length == 1) {
                // there is only the default left, delete it!
                $scope.ui.current_message.branches = [];
            }

        }
    }

    $scope.editCondition = function(condition) {
        $scope.ui.current_condition = condition;
        $scope.esckey();
        $scope.openDialog('/plugins/cms/edit_condition.html');
    }

    $scope.addBranch = function(message) {
        if (!message.branches) {
            message.branches = [];
        }

        if (!message.branches.length) {
            message.branches.push({
                default: true,
                action: 'next'
            });
        }



        message.branches.push({
            pattern: 'test',
            type: 'string',
            action: 'next',
        });
    }

    console.log('BOOTED MESSAGE DETAIL');


}]);


app.controller('edit_condition', ['$scope', '$sce', function($scope, $sce) {

    console.log('BOOTED CONDITION DETAIL');
    if ($scope.esckey) { $scope.esckey(); console.log('cleared handler'); }

    $scope.esckey2 = $scope.$on('escape_key', function() {
      console.log('HEARD conditional ESCAPE KEY');
      $scope.closeDialog();
      $scope.$apply();
    });

    $scope.closeDialog = function() {
        $scope.esckey2();
        if ($scope.ui.current_message) {
            $scope.openDialog('/plugins/cms/message_detail.html');
        } else {
            $scope.ui.edit_dialog_open = false;
            $scope.ui.edit_dialog_template = null;
        }
        console.log('DIALOG CLOSED');
    }

    $scope.summarize = function(message) {
        if (message.text) {
            return $sce.trustAsHtml(message.text[0]);
        } else {
            return $scope.describeAction(message);
        }
    }

    $scope.summarizeThread = function(script, thread) {

        console.log('summarize thread for ', script);
        return $scope.summarize(script.threads.filter(function(t) {
            return t.topic == thread
        })[0].messages[0]);

    }

    // $scope.describeAction = function(opts) {
    //     var txt = '';
    //     if (opts.action) {
    //         var actions = $scope.ui.available_actions.filter(function(a) {
    //             return a.type == opts.action
    //         });
    //         if (actions.length) {
    //             txt = actions[0].description;
    //         } else {
    //             txt = opts.action;
    //         }
    //     }
    //     return $sce.trustAsHtml(txt);
    // }


    $scope.showThreads = function(id) {

        $scope.request({
            method: 'get',
            url: '/admin/api/scripts/' + id
        }).then(function(script) {

            $scope.useThreadsForResults(script);
        }).catch($scope.handleError);


    }

    $scope.useThreadsForResults = function(script) {
        var threads = [];
        for (var t = 0; t < script.threads.length; t++) {

            threads.push({
                command: script.command,
                _id: script._id,
                $$match_type: 'thread',
                $$match_thread: script.threads[t].topic,
                $$match_summary: $scope.summarize(script.threads[t].messages[0]),
                threads: script.threads,
            });


        }

        $scope.ui.search_results = threads;

        $scope.$apply();
    }

    $scope.magicSummary = function(thread, query) {

        var res = [];

        // find messages that mention query
        if (query) {
            var pattern = new RegExp(query, 'i');

            var mentions = thread.messages.filter(function(m) {
                if (m.text) {
                    return (m.text[0].match(query));
                }
            })

            if (mentions.length) {
                if (thread.messages.indexOf(mentions[0]) != 0) {
                    res.push({
                        text: $scope.summarize(thread.messages[0])
                    });
                }

                var gap = thread.messages.indexOf(mentions[0]);
                if (gap > 1) {
                    res.push({
                        text: '...',
                        type: 'ellipsis'
                    })
                }
                res.push({
                    text: $scope.summarize(mentions[0])
                });

                if (gap < thread.messages.length) {
                    res.push({
                        text: '...',
                        type: 'ellipsis'
                    })
                }
            } else {
                res.push({
                    text: $scope.summarize(thread.messages[0])
                });
            }
        } else {
            res.push({
                text: $scope.summarize(thread.messages[0])
            });
        }

        return res;

    }

    $scope.showStartingPoints = function(script) {
        var points = [];
        if ($scope.ui.q) {

            // TODO: protect against bad regexp
            var pattern = new RegExp($scope.ui.q, 'i');

            points = script.threads.filter(function(t) {

                // if topic matches, its in
                if (t.topic.match(pattern)) {
                    return true;
                }

                // if any message matches, also in
                if (t.messages.filter(function(m) {

                        if (m.text && m.text[0].match(pattern)) {
                            return true;
                        }

                    }).length) {
                    return true;
                };

            });

            // if none left, show all.
            // this might happen when the search matches the SCRIPT NAME but not any specific threads or messages
            if (!points.length) {
                points = script.threads;
            }

        } else {
            points = script.threads;
        }

        $scope.ui.starting_point = script;
        $scope.ui.starting_points = points.map(function(t) {
            t.$$summary = $scope.magicSummary(t, $scope.ui.q);
            return t;
        });
        // $scope.$apply();
    }


    $scope.searchScripts = function(q, includeTopics, includeText, limit) {

        console.log('searching for ', q);
        $scope.request({
            method: 'get',
            url: '/admin/api/scripts',
            params: {
                q: q,
                limit: limit || 5,
                topics: includeTopics ? true : null,
                text: includeText ? true : null,
            }
        }).then(function(scripts) {
            console.log('got scripts:', scripts);

            $scope.ui.search_results = scripts;
            if (scripts.length && q) {
                $scope.showStartingPoints(scripts[0]);
            }
            $scope.$apply();
            return;


            var pattern;
            // TODO: protect against bad regexp
            if (q) {
                pattern = new RegExp(q, 'i');
            }

            if (pattern) {
                for (var s = 0; s < scripts.length; s++) {
                    // what matches? command, topic, or message text?
                    var match = null;
                    if (scripts[s].command.match(pattern)) {
                        scripts[s].$$match_type = 'name';
                        // scripts[s].$$match_thread = 'default';
                        scripts[s].$$match_summary = $scope.summarize(scripts[s].threads.filter(function(t) {
                            return t.topic == 'default'
                        })[0].messages[0]);

                    } else if (scripts[s].threads.filter(function(t) {
                            return t.topic.match(pattern);
                        }).length) {
                        scripts[s].$$match_type = 'topic';
                        scripts[s].$$match_thread = scripts[s].threads.filter(function(t) {
                            return t.topic.match(pattern)
                        })[0].topic;
                        scripts[s].$$match_summary = $scope.summarize(scripts[s].threads.filter(function(t) {
                            return t.topic.match(pattern)
                        })[0].messages[0]);
                    } else {
                        scripts[s].$$match_type = 'text';

                        var matches = scripts[s].threads.map(function(thread) {

                            var m = thread.messages.filter(function(message) {
                                if (message.text) {
                                    if (message.text[0].match(pattern)) {
                                        return true;
                                    }
                                }
                            });

                            if (m.length) {
                                return {
                                    thread: thread.topic,
                                    summary: $scope.summarize(m[0]),
                                }
                            }
                        });

                        matches = matches.filter(function(m) {
                            return m;
                        });

                        scripts[s].$$match_thread = matches[0].thread;
                        scripts[s].$$match_summary = matches[0].summary;


                    }
                }
            }


            // if only 1 is returned, and it is not a specific thread or message, show all threads
            // if (scripts.length == 1 && scripts[0].$$match_type == 'name') {
            //   return $scope.useThreadsForResults(scripts[0])
            // }

            $scope.ui.search_results = scripts;


            $scope.$apply();
        }).catch($scope.handleError);
    }

}]);

app.controller('gotothread_controller', ['$scope', function($scope) {

}]);

app.controller('execute_script_widget', ['$scope', function($scope) {

    $scope.ui.search_results = [];
    delete($scope.ui.starting_point);
    delete($scope.ui.starting_points);
    delete($scope.ui.execute_script);

    $scope.ui.q = '';
    $scope.ui.limit = 5;

    $scope.loadMore = function() {
        $scope.ui.limit = $scope.ui.limit + 20;
        $scope.searchScripts($scope.ui.q, true, true, $scope.ui.limit);
    }

    console.log('BOOTED EXECUTE SCRIPT WIDGET');
    if ($scope.ui.current_condition.options && $scope.ui.current_condition.options.script) {
        console.log('GOT EXISTING SETTING')

        $scope.request({
            method: 'get',
            url: '/admin/api/scripts/' + $scope.ui.current_condition.options.script_id
        }).then(function(script) {
            console.log('jump to script:', script);
            $scope.ui.execute_script = script;
            $scope.$apply();
        }).catch($scope.handleError);
    }

    $scope.searchScripts();


    // TODO: one day hopefully a plugin like this would have some official mechanism for extending the model
    $scope.selectScript = function(id, script, thread) {
        $scope.ui.current_condition.options = {
            script_id: id,
            script: script,
            thread: thread,
        }

        $scope.request({
            method: 'get',
            url: '/admin/api/scripts/' + $scope.ui.current_condition.options.script_id
        }).then(function(script) {
            $scope.ui.execute_script = script;
            $scope.resetSearch();
            $scope.$apply();
        }).catch($scope.handleError);
    }

    $scope.resetSearch = function() {
        delete($scope.ui.starting_point);
        delete($scope.ui.starting_points);
        delete($scope.ui.search_results);
        $scope.searchScripts();
    }

    $scope.resetExecute = function() {
        delete($scope.ui.execute_script);
        delete($scope.ui.current_condition.options);
        $scope.searchScripts();

    }

}]);
