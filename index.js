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
        moduleBase: 'src/js/',
        excModule: []
    }, options);

    var excModule = options.excModule;
    var definePrefix = options.definePrefix
    var moduleBase = options.moduleBase;
    var moduleBasePath;

    return through.obj(bufferContents, endStream);

    function bufferContents(file, enc, cb) {
        // ignore empty files
        if (file.isNull()) {
            cb();
            return;
        }
        if (!moduleBasePath) {
            moduleBasePath = path.join(file.cwd, moduleBase).replace(/\\/g, '/');
        }

        // we dont do streams (yet)
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
            // console.log(moduleMap[moduleId].file.path)
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
                // console.log('moduleId:', moduleId, 2222);
                file.contents = new Buffer(concatModule(moduleId, moduleMap, excModule));

                this.push(file);
                // requireModuleDeps(moduleId, moduleMap, excModule, moduleBasePath);
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
        // console.log('moduleId333:', moduleId, 333);
        if (!moduleObj) {
            throw Error('moduleId(' + moduleId + ') requireModuleDeps error: module is not defined!');
        }
        if (moduleObj.deps) {
            return moduleObj.deps;
        }
        moduleObj.deps = {};
        // var fileFullPath = moduleObj.filepath;
        var fileFullPath = moduleObj.file.path;
        var fileFolderPath = path.dirname(fileFullPath);
        var src = moduleObj.src;

        removeComment(src).replace(/\brequire\(['"](.*?)['"]\)/g, function(_, moduleId) {

            if (/^\./.test(moduleId)) {
                moduleId = path.join(fileFolderPath, moduleId).replace(/\\/g, '/').replace(new RegExp('^' + moduleBasePath), '').replace(/^[\\\/]/, '');
                moduleId = moduleId.replace(/\.js$/, '');
            }
            if (excModule.indexOf(moduleId) != -1) {
                return;
            }
            moduleObj.deps[moduleId] = 1;
            var _deps = requireModuleDeps(moduleId, moduleMap, excModule);
            for (var mid in _deps) {
                moduleObj.deps[mid] = 1;
            }
        });
        return moduleObj.deps;
    }

    function requireRegModuleDeps(moduleId, moduleMap, excModule) {
        var moduleObj = moduleMap[moduleId];
        if (!moduleObj) {
            throw 'moduleId(' + moduleId + ') requireRegModuleDeps error: module is not defined!';
        }
        var deps = moduleObj.deps;
        var moduleMiddleSrc = [moduleObj.src];
        var depsMap = {};
        for (var mid in deps) {
            moduleMiddleSrc.push(moduleMap[mid].src);
            depsMap[mid] = 1;
        }
        moduleMiddleSrc = moduleMiddleSrc.join('\n');

        var regList = [];

        removeComment(moduleMiddleSrc, {
            block: 1
        }).replace(/\/\/\/require\(['"](.*?)['"]\)/g, function(_, moduleReg) {
            regList.push('(' + moduleReg.replace(/^\^/, '') + ')');
        });

        var reg = regList.length && new RegExp('^' + regList.join('|'));
        if (reg) {
            if (reg.test(moduleId)) {
                throw 'reg moduleId(' + moduleId + ') concat error://require("moduleReg") have circular reference->' + reg;
            }

            for (var _moduleId in moduleMap) {
                if (excModule.indexOf(moduleId) == -1 && reg.test(_moduleId)) {
                    depsMap[_moduleId] = 1;
                    for (var mid in moduleMap[_moduleId].deps) {
                        depsMap[mid] = 1;
                    }
                }
            }
        }
        var allDeps = [moduleId];

        for (var mid in depsMap) {
            allDeps.push(mid);
        }

        return allDeps;
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