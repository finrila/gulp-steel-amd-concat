
# gulp-steel-amd-concat

## 用途
    把js文件进行合并处理，把当前js文件require或$Import的代码合并到一个js文件里。
## 用法
``` javascript
    var steelAmdConcat = require('gulp-steel-amd-concat');
    steelAmdConcat();
```
## 示例
``` javascript
    gulp.src(['src/js/**/*.js'])
        .pipe(steelAmdConcat())
        .pipe(gulp.dest('front_server/js/'));
```


