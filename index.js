/**
 * steel amd concat
 * @author Finrila finrila@gmail.com
 */
'use strict';
var through = require('through2');
var gutil = require('gulp-util');
var extend = require('util')._extend;
var path = require('path');
var fs = require('fs');

module.exports = function(options) {
    var moduleMap = {};

    options = extend({
        definePrefix: 'steel.d',
        excModule: []
    }, options);

    var excModule = options.excModule;
    var definePrefix = options.definePrefix
    var moduleBasePath;

    return through.obj(bufferContents, endStream);

    function bufferContents(file, enc, cb) {
        if (file.isNull()) {
            cb();
            return;
        }
        if (!moduleBasePath) {
            moduleBasePath = file.base.replace(/\\/g, '/');
        }

        if (file.isStream()) {
            this.emit('error', new PluginError('gulp-concat', 'Streaming not supported'));
            cb();
            return;
        }

        var filepath = file.relative.replace(/\\/g, '/');
        var src = file.contents.toString('utf8');
        var match = src.match(new RegExp(definePrefix + '\\(["\\\'](.*?)[\\\'"]'));
        if (match) {
            var moduleId = match[1];
            moduleMap[moduleId] = {
                src: src,
                file: file
            };
        }
        cb();
    }

    function endStream(cb) {
        try {
            for (var moduleId in moduleMap) {
                requireModuleDeps(moduleId, moduleMap, excModule, moduleBasePath);
                var file = moduleMap[moduleId].file;
                var filepath = moduleMap[moduleId].file.path;
                var src = moduleMap[moduleId].src;
                file.contents = new Buffer(concatModule(moduleId, moduleMap, excModule));
                this.push(file);
            }
        } catch (e) {
            gutil.log(e);
        }
        cb();
    }

    function concatModule(moduleId, moduleMap, excModule) {
        
        var deps = requireRegModuleDeps(moduleId, moduleMap, excModule);
        var ret = [];
        deps.forEach(function(mid) {
            ret.push(moduleMap[mid].src);
        });
        return ret.join('\n');
    }

    function requireModuleDeps(moduleId, moduleMap, excModule) {
        var moduleObj = moduleMap[moduleId];
        if (!moduleObj) {
            throw Error('moduleId(' + moduleId + ') requireModuleDeps error: module is not defined!');
        }
        if (moduleObj.deps) {
            return;
        }
        var deps = [];
        var fileFullPath = moduleObj.file.path;
        var fileFolderPath = path.dirname(fileFullPath);
        var src = moduleObj.src;

        removeComment(src).replace(/\brequire\([ \t\n\r]*['"](.*?)['"][ \t\n\r]*\)/g, function(_, moduleId) {

            if (/^\./.test(moduleId)) {
                moduleId = path.join(fileFolderPath, moduleId).replace(/\\/g, '/').replace(new RegExp('^' + moduleBasePath), '').replace(/^[\\\/]/, '');
                moduleId = moduleId.replace(/\.js$/, '');
            }
            if (excModule.indexOf(moduleId) != -1) {
                return;
            }
            requireModuleDeps(moduleId, moduleMap, excModule);
            if (deps.indexOf(moduleId) === -1) {
                var _deps = moduleMap[moduleId].deps;
                for(var i = 0, l = _deps.length; i < l; ++i) {
                    if (deps.indexOf(_deps[i]) === -1) {
                        deps.push(_deps[i]);
                    }
                }
                deps.push(moduleId);
            }
        });
        moduleObj.deps = deps;
    }

    function requireRegModuleDeps(moduleId, moduleMap, excModule) {
        var moduleObj = moduleMap[moduleId];
        if (!moduleObj) {
            throw 'moduleId(' + moduleId + ') requireRegModuleDeps error: module is not defined!';
        }
        var deps = moduleObj.deps;
        var moduleMiddleSrc = [moduleObj.src];
        var all = deps.slice();
        for(var i = 0, l = deps.length; i < l; ++i) {
            moduleMiddleSrc.push(moduleMap[deps[i]].src);
        }
        moduleMiddleSrc = moduleMiddleSrc.join('\n');

        var regList = [];

        removeComment(moduleMiddleSrc, {
            block: 1
        }).replace(/\/\/\/require\([ \t\n\r]*['"](.*?)['"][ \t\n\r]*\)/g, function(_, moduleReg) {
            regList.push('(' + moduleReg.replace(/^\^/, '') + ')');
        });

        var reg = regList.length && new RegExp('^' + regList.join('|'));
        if (reg) {
            if (reg.test(moduleId)) {
                throw 'reg moduleId(' + moduleId + ') concat error://require("moduleReg") have circular reference->' + reg;
            }

            for (var _moduleId in moduleMap) {
                if (excModule.indexOf(moduleId) == -1 && reg.test(_moduleId)) {
                    if (all.indexOf(_moduleId) === -1) {
                        var _deps = moduleMap[_moduleId].deps;
                        for(var i = 0, l = _deps.length; i < l; ++i) {
                            if (all.indexOf(_deps[i]) === -1) {
                                all.push(_deps[i]);
                            }
                        }
                        all.push(_moduleId);
                    }
                }
            }
        }
        all.push(moduleId);
        return all;
    }
};

function removeComment(src, options) {
    options = options || {
        line: true,
        block: true
    };

    if (options.line) {
        src = src.replace(/(?:^|\n|\r)\s*\/\/.*(?:\r|\n|$)/gm, '\n');
    }
    if (options.block) {
        src = src.replace(/(?:^|\n|\r)\s*\/\*[\s\S]*?\*\/\s*(?:\r|\n|$)/g, '\n');
    }
    return src;
};