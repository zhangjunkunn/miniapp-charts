/**
 * @author: zimyuan
 * @lase-edit-date: 2018-05-18
 */

import {
    extend,
    deepCopy,
    changeUnit,
    isPlainObject,
    getDataRangeAndStep,
    none,
    updateBezierControlPoints
} from './util.js';

import config    from './config/linechart.js';
import Base      from './base/index.js';

/**
 * 小程序折线图绘制组件
 */
export default class LineChart extends Base {
    /**
     * @param { CanvasContext } ctx1: 小程序的绘图上下文
     * @param { CanvasContext } ctx2: 小程序的绘图上下文
     * @param { Object } cfg: 组件配置
     */
    constructor(ctx1, cfg = {}, ctx2) {
        super();

        this.chartType = 'line';

        this.ctx1 = ctx1;

        // 用于绘制tooltip以提高性能，如果没有，则在ctx1上绘制
        this.ctx2 = ctx2 || ctx1;

        /**
         * 约定！所有的内部变量都需要这里先声明
         * 可以大大提高源码阅读性
         */

        // 本实例配置文件
        this._config      = this.getConfig(cfg, deepCopy(config));

        // 线条数据
        this._datasets    = [];

        // 用于触摸事件的函数节流
        this._touchTimer  = 0;
    }

    calPointData() {
        let pointData      = [];
        let yAxisWidth     = this._render.yAxisWidth;
        let leftBottom     = this._boundary.leftBottom;
        let startX         = leftBottom.x + yAxisWidth;
        let longestLine    = this._render.longestLine;

        // 为了提高性能，会限制单条线最多圆的数量
        let needCircle     = !!(  this._config.lineStyle.maxCircleCount >= longestLine.points.length )

        // 原点
        let origin     = {
            x: leftBottom.x + yAxisWidth,
            y: leftBottom.y,
        };
        let circlePoints = []

        let second = this._render.second;
        this._alldatasets.forEach((oneline ) => {
            let min       = oneline.axis !== 2 ? this._render.min : second.min;
            let unitY     = oneline.axis !== 2 ? this._render.unitY: second.unitY;
            let yMultiple = oneline.axis !== 2 ? this._render.yMultiple: second.yMultiple;

            let style  = oneline.style;
            let cStyle = style.circle;

            let points   = oneline.points;
            let length   = points.length;
            let _oneline = {
                points     : [],
                style
            };

            points.forEach((item, index) => {
                if ( item.show !== false ) {
                    if ( index < length ) {
                        let temp = {
                            x: startX + index * this._render.unitX,
                            y: leftBottom.y - ( item.y - min) * unitY * yMultiple,
                        };

                        if ( style.circle && style.circle.show && needCircle ) {
                            let circle = {
                                x          : temp.x,
                                y          : temp.y,
                                r          : cStyle.radius      || 2,
                                fillColor  : cStyle.fillColor   || '#FFFFFF',
                                strokeColor: style.lineColor,
                                lineWidth  : style.lineWidth,
                            };

                            circlePoints.push(circle);
                        }

                        _oneline.points.push(temp);
                    }
                }
            });

            if ( points.length > 1 ) {
                // 为了能够实现闭合，增加的辅助点
                _oneline.points.unshift(origin);
                _oneline.points.push({
                    x           : _oneline.points[_oneline.points.length - 1].x,
                    y           : leftBottom.y,
                });

                updateBezierControlPoints(_oneline.points, this._area);

                pointData.push(_oneline);
            }
        });

        this._render.circlePoints = circlePoints;
        this._render.pointData    = pointData;
    }

    calXAxisLines() {
        let yAxisWidth  = this._render.yAxisWidth;
        let leftBottom  = this._boundary.leftBottom;
        let rightBottom = this._boundary.rightBottom;
        let xAxisLine   = this._config.xAxisLine;

        // 计算X轴中轴线数据
        this._render.xCenterAxis = {
            start: {
                x: leftBottom.x + yAxisWidth,
                y: leftBottom.y
            },
            end  : {
                x: rightBottom.x,
                y: leftBottom.y
            },
            width: xAxisLine.width,
            color: xAxisLine.color,
        }

        if ( this._render.second ) {
            this._render.xCenterAxis.end.x -= this._render.second.width;
        }
    }

    /**
     * 计算用于X轴绘制需要的数据
     */
    calXAxis() {
        let data        = this._render;

        let length      = this._render.longestLinePointCnt;
        let maxXPoint   = this._config.xAxis.xAxisCount;
        let points      = this._render.longestLine.points;
        let xAxis       = this._config.xAxis;

        let leftBottom  = this._boundary.leftBottom;
        let rightBottom = this._boundary.rightBottom;

        let xAxisData   = [];

        // 计算X轴两个点之间的像素距离
        let realWidth =  rightBottom.x - leftBottom.x - this._render.yAxisWidth;
        if ( this._render.second ) {
            realWidth -= this._render.second.width;
        }

        let pointCount = (  points.length - 1 > 0
                          ? points.length - 1
                          : 1  );
        data.unitX = realWidth  / pointCount;

        let xDivider  = Math.ceil(length / ( maxXPoint ) );

        // 考虑只有一个点的情况
        if ( xDivider === 0 ) {
            xDivider = 1;
        }

        let leftStart = this._render.yAxisWidth + leftBottom.x;
        let bottom    = leftBottom.y + xAxis.marginTop + xAxis.fontSize;

        for ( let i = 0; i < maxXPoint; i++ ) {
            let index = (  i * xDivider >= length
                         ? length - 1
                         : i * xDivider  );

            let word = {
                text    : points[index].x,
                color   : xAxis.color,
                fontSize: xAxis.fontSize,
                x       : leftStart + index * data.unitX,
                y       : bottom
            }

            let width = this.measureText(this.ctx1, word);
            word.x -= width / 2;

            // 防止超边界
            if ( word.x + width > this._config.width )
                word.x = this._config.width - width - 1;

            xAxisData.push(word);
        }

        this._render.xAxisData = xAxisData;
    }

    calYAxisLines() {
        let data       = this._render;
        let yAxisWidth = data.yAxisWidth;
        let leftTop    = this._boundary.leftTop;
        let leftBottom = this._boundary.leftBottom;
        let rightTop   = this._boundary.rightBottom;
        let yAxisLine  = this._config.yAxisLine;

        // 计算Y轴中轴线数据
        this._render.yCenterAxis = {
            start: {
                x: leftTop.x + yAxisWidth,
                y: leftTop.y
            },
            end  : {
                x: leftTop.x + yAxisWidth,
                y: leftBottom.y
            },
            width: yAxisLine.width,
            color: yAxisLine.color,
        }

        this._render.yAxisLines = [];
        let second = this._render.second;
        this._render.yAxisData.forEach((item, index) => {
            if ( index > 0 ) {
                this._render.yAxisLines.push({
                    start: {
                        x: item.x + yAxisWidth,
                        y: item.y
                    },
                    end: {
                        x: rightTop.x - ( second && second.width || 0),
                        y: item.y
                    },
                    width: yAxisLine.width,
                    color: yAxisLine.color,
                });
            }
        });
    }

    calSecondYAxis() {
        let { max, min, yDivider, maxYPoint, longestLine, yMultiple } = this.calYAxisBoundary(this._secondDatasets);

        let second = {};
        this._render.second = second;

        second.min       = min;
        second.max       = max;
        second.yMultiple = yMultiple;

        let yAxis      = this._config.secondYaxis;

        // 用于绘制的数据
        let yAxisData  = [];

        // Y轴文案所占据的宽度
        let yAxisWidth = 0;

        // 计算Y轴上两个点之间的像素值
        let unitY = (  (  this._boundary.leftBottom.y
                        - this._boundary.leftTop.y  )
                     / ( yDivider * yMultiple  * this._config.yAxis.yAxisCount )
                    );

        let changeFunc = this._config.secondChangeUnit || this._config.changeUnit || changeUnit;
        let toFixed     = (  ( max < 1 || max > 1e7 )
                           ? 2
                           : 1 );

        let bottomStart = this._boundary.leftBottom.y;

        for( let i = 0; i < this._config.yAxis.yAxisCount + 1; i++ ) {
            let word = {
                text     : changeFunc(min + i * yDivider, toFixed) + (yAxis.unit || ''),
                color    : yAxis.color,
                fontSize : yAxis.fontSize,
                y        : bottomStart - ( i * yDivider * unitY * yMultiple ),
                textAlign: yAxis.textAlign,
            };

            yAxisWidth = Math.max(this.measureText(this.ctx1, word), yAxisWidth);

            this.measureText(this.ctx1, word);

            yAxisData.push(word);
        }

        // 考虑Y轴不需要文案的情况
        yAxisWidth = (  yAxis.show
                      ? yAxisWidth
                      : 0  );

        let leftStart = this._boundary.rightTop.x - yAxisWidth;
        if ( yAxis.textAlign === 'right' ) {
            leftStart += yAxisWidth;
        }

        for( let i = 0; i < this._config.yAxis.yAxisCount + 1; i++ ) {
            yAxisData[i].x  = leftStart;
        }

        second.unitY               = unitY;
        second.yAxisWidth          = yAxisWidth;
        second.yAxisData           = yAxisData;
        second.longestLinePointCnt = maxYPoint;
        second.longestLine         = longestLine;
        second.width               = yAxisWidth + yAxis.marginLeft;

        this.log('calSecondYAxis');
    }

    /**
     * 计算Y轴的边界和阶梯值
     */
    calYAxis() {
        let { max, min, yDivider, maxYPoint, longestLine, yMultiple } = this.calYAxisBoundary(this._datasets);

        this._render.min       = min;
        this._render.max       = max;
        this._render.yMultiple = yMultiple;

        let yAxis      = this._config.yAxis;

        // 用于绘制的数据
        let yAxisData  = [];

        // Y轴文案所占据的宽度
        let yAxisWidth = 0;

        // 计算Y轴上两个点之间的像素值
        let unitY = (  (  this._boundary.leftBottom.y
                        - this._boundary.leftTop.y  )
                     / ( yDivider * this._render.yMultiple  * this._config.yAxis.yAxisCount )
                    );

        let leftStart   = this._boundary.leftTop.x + yAxis.marginLeft;
        let bottomStart = this._boundary.leftBottom.y

        let changeFunc  = this._config.changeUnit || changeUnit;
        let toFixed     = (  ( max < 1 || max > 1e7 )
                           ? 2
                           : 1 );

        for( let i = 0; i < this._config.yAxis.yAxisCount + 1; i++ ) {
            let word = {
                text    : changeFunc(min + i * yDivider, toFixed) + (yAxis.unit || ''),
                color   : yAxis.color,
                fontSize: yAxis.fontSize,
                x       : leftStart,
                y       : bottomStart - ( i * yDivider * unitY * this._render.yMultiple )
            };

            yAxisWidth = Math.max(this.measureText(this.ctx1, word), yAxisWidth);

            yAxisData.push(word);
        }

        // 考虑Y轴不需要文案的情况
        yAxisWidth = ( yAxis.show
                      ? yAxisWidth + yAxis.marginRight
                      : 0  );

        this._render.unitY               = unitY;
        this._render.yAxisWidth          = yAxisWidth;
        this._render.yAxisData           = yAxisData;
        this._render.longestLinePointCnt = maxYPoint;
        this._render.longestLine         = longestLine;

        this.log('calYAxis');
    }

    getMinY(data) {
        return data.reduce(
            (min, p) => (  p.y < min
                         ? p.y
                         : min  ),
            data[0].y
        );
    }

    getMaxY(data) {
        return data.reduce(
            (max, p) => (  p.y > max
                         ? p.y
                         : max  ),
            data[0].y
        );
    }

    /**
     * 计算用于Y轴绘制需要的数据
     * https://codeburst.io/javascript-finding-minimum-and-maximum-values-in-an-array-of-objects-329c5c7e22a2
     */
    calYAxisBoundary(datasets) {
        let maxYPoint   = 0;
        let longestLine = datasets[0];
        let yAxisCount  = this._config.yAxis.yAxisCount;
        let max         = -Infinity;
        let min         = Infinity;

        datasets.forEach((oneline) => {
            let points = oneline.points || [];

            if ( points.length > maxYPoint ) {
                maxYPoint   = points.length;
                longestLine = oneline;
            }

            max = Math.max(this.getMaxY(points), max);
            min = Math.min(this.getMinY(points), min);
        });

        let formatFunc = this._config.formatY !== none ? this._config.formatY : getDataRangeAndStep;
        let range = formatFunc(max, min, yAxisCount);

        return {
            max      : range.max,
            min      : range.min,
            yDivider : range.divider,
            yMultiple: range.multiple || 1,
            maxYPoint,
            longestLine,
        };
    }

    /**
     * 计算tooltip当前点数据和标尺线数据
     */
    calToolTipPointData(e) {
        let touchesx = e.touches[0].x;

        let leftTop    = this._boundary.leftTop;
        let rightTop   = this._boundary.rightTop;
        let leftBottom = this._boundary.leftBottom;

        let longestLine = this._render.longestLine;

        let yAxisWidth = this._render.yAxisWidth;
        let leftDis    = touchesx - ( leftTop.x + yAxisWidth );

        // 边界值场景
        if ( leftDis < 0 ) {
            leftDis = 0;
        }

        else if ( leftDis > rightTop.x ) {
            leftDis = rightTop.x;
        }

        // 取出当前手指对应的点索引
        let pindex = Math.round(leftDis / this._render.unitX );

        if ( pindex > longestLine.points.length - 1 )
            pindex = longestLine.points.length - 1;

        this._render.toolTipData = {
            // 用于突出当前点的圆
            currPoints: [],
            pindex    : pindex,
            leftDis,
        };

        this._alldatasets.forEach(( oneline, index ) => {
            let points = this._render.pointData[index].points;
            let originPoint = oneline.points[pindex];
            // pointData为了将折线图形成封闭，在开始和结束分别增加了一个辅助点
            let curr   = points[pindex + 1];
            let style  = oneline.style;

            // 可能出现有些线比较短的情况
            if ( curr && originPoint && originPoint.show !== false ) {
                let temp = {
                    x          : curr.x,
                    y          : curr.y,
                    st         : 0,
                    ed         : 2 * Math.PI,
                    r          : style.circle.radius,
                    fillColor  : style.lineColor,
                    strokeColor: style.lineColor,
                };

                this._render.toolTipData.currPoints.push(temp);
            }
        });

        let one          = this._render.toolTipData.currPoints[0];
        let toolTipStyle = this._config.toolTip;

        if ( one ) {
            // 标尺
            this._render.toolTipData.currPointsLine = {
                start: {
                    x: one.x,
                    y: leftTop.y,
                },
                end: {
                    x: one.x,
                    y: leftBottom.y
                },
                color: toolTipStyle.lineColor,
                width: toolTipStyle.lineWidth,
            }
            return one;
        } else {
            return false;
        }
    }

    /**
     * 计算tooltip的容器样式数据
     */
    calToolTipWordData() {
        this._render.toolTipData.circles = [];

        let wrapper     = this._render.toolTipData.wrapper;
        let longestLine = this._render.longestLine;
        let style       = this._config.toolTip;
        let baseX       = wrapper.x;
        let baseY       = wrapper.y ;
        let words       = this._render.toolTipData.words;
        let title;

        if ( style.needTitle ) {
            title    = {
                x       : 0,
                y       : baseY + style.fontSize + style.linePadding,
                fontSize: style.fontSize,
                color   : style.color,
                text    : longestLine.points[this._render.toolTipData.pindex].x,
            };

            baseY += style.fontSize + style.linePadding;
        }

        words.forEach((word, index) => {
            word.x = baseX + style.padding.left;

            word.y = (  baseY
                      + style.padding.top
                      // 对于文字而言，是以文字左下角为圆点，所以还需要加上一个行高
                      + style.fontSize
                      + index * (style.fontSize + style.linePadding) );

            let circle = {
                x          : baseX + style.padding.left + style.fontSize / 2,
                y          : word.y - style.fontSize / 2 + 1,
                strokeColor: word.line.style.lineColor,
                fillColor  : word.line.style.lineColor,
                r          : style.fontSize / 2,
            }

            this._render.toolTipData.circles.push(circle);

            word.x += ( style.fontSize + 5);
        });

        if ( title ) {
            title.x = words[0].x;
            words.unshift(title);
        }
    }

    calToolTipWrapperData() {
        let style       = this._config.toolTip;
        let pindex      = this._render.toolTipData.pindex;

        let maxWidth    = 0;

        // tooltip的总宽度
        let width       = (  style.padding.left
                           + style.padding.right
                           // 圆点的直径
                           + style.fontSize
                           // 圆点的右边距
                           + 5  );

        let height     = (  style.padding.top
                          + style.padding.bottom
                          // 第一行用于绘制当前X坐标的坐标值
                          + ( style.needTitle ? style.fontSize + style.linePadding : 0 )
                         );

        this._render.toolTipData.words = [];

        let changeFunc  = this._config.secondChangeUnit || this._config.changeUnit || changeUnit;
        let toFixed     = (  ( this._render.max < 1 || this._render > 1e7 )
                           ? 2
                           : 1 );

        this._alldatasets.forEach(( oneline ) => {
            let points = oneline.points;
            let curr   = points[pindex];

            let title = (style.needX ? curr && (curr.x + '-') : '');
            title += ( oneline.lineName || '') + ': ';

            if ( curr ) {
                let word = {
                    text    : title + changeFunc(curr.y, toFixed) + (oneline.unit || ''),
                    fontSize: style.fontSize,
                    color   : style.color,
                    x       : 0,
                    y       : 0,
                    // 方便后续引用
                    line    : oneline,
                };

                // 计算当前时刻最长单词的宽度
                maxWidth = Math.max(maxWidth, this.measureText(this.ctx1, word));

                // 加上每行文字的行高和行间距
                height += ( style.fontSize + style.linePadding );

                this._render.toolTipData.words.push(word);
            }
        });

        width += maxWidth;

        let data     = this._render.toolTipData;
        let leftTop  = this._boundary.leftTop;
        let rightTop = this._boundary.rightTop;

        this._render.toolTipData.wrapper = {
            width,
            height,

            x: (  rightTop.x - data.currPointsLine.start.x  > width
                ? data.currPointsLine.start.x + 3
                : data.currPointsLine.start.x - width - 3  ),

            y: leftTop.y + 10,
            fillColor: style.fillColor,
        }
    }

    /**
     * 计算悬浮提示数据
     * 这里的计算其实非常繁琐而不可避免，为了提高阅读性，尽量分成三大步来计算
     * 与initData相同的是，这里的函数调用顺序同样不能随便更改
     */
    calToolTipData(e) {
        let point = this.calToolTipPointData(e);

        if ( point ) {
            this.calToolTipWrapperData(e);
            this.calToolTipWordData(e);
        }
    }

    // 绘制X轴
    drawXAxis() {
        // 绘制Y轴文案
        this._render.xAxisData.forEach((item) => {
            this.drawWord(this.ctx1, item);
        });

        if ( this._config.xAxisLine.centerShow ) {
            this.drawLine(this.ctx1, this._render.xCenterAxis);
        }
    }

    // 绘制Y轴
    drawYAxis() {
        // 绘制Y轴文案
        this._render.yAxisData.forEach((item) => {
            this.drawWord(this.ctx1, item);
        });

        // 根据配置来决定是否绘制Y中心轴
        if ( this._config.yAxis.centerShow ) {
            this.drawLine(this.ctx1, this._render.yCenterAxis);
        }

        if ( this._render.second ) {
            this._render.second.yAxisData.forEach((item) => {
                this.drawWord(this.ctx1, item);
            });
        }
    }

    // 绘制Y轴横线
    drawYAxisLine() {
        if ( this._config.yAxisLine.show ) {
            this._render.yAxisLines.forEach((line) => {
                this.drawLine(this.ctx1, line);
            });
        }
    }

    // 绘制X轴的竖线
    drawXAxisLine() {
    }

    /**
     * 绘制所有的点
     */
    drawPoints() {
        this._render.pointData.forEach((oneline) => {
            if ( oneline.points.length > 1 ) {
                this.drawLongLineWithFill(this.ctx1, oneline.points, oneline.style);
            }
        });

        this._render.circlePoints.forEach((point) => {
            this.drawCircle(this.ctx1, point);
        });
    }

    drawToolTip() {
        let data = this._render.toolTipData;

        data.currPoints.forEach((point) => {
            this.drawCircle(this.ctx2, point);
        });

        this.drawLine(this.ctx2, data.currPointsLine);

        this.drawRect(this.ctx2, data.wrapper);

        data.words.forEach((word) => {
            this.drawWord(this.ctx2, word);
        });

        data.circles.forEach((circle) => {
            this.drawCircle(this.ctx2, circle);
        });
    }



    /**
     * 将处理后的合法数据按照配置绘制到canvas上面
     */
    drawToCanvas() {
        this.drawYAxis();
        this.log('drawYAxis');

        this.drawYAxisLine();
        this.log('drawYAxisLine');

        this.drawXAxis();
        this.log('drawXAxis');

        this.drawPoints();
        this.log('drawPoints');
    }

    initDataSets(data) {
        let datasets = data.datasets || [];

        let _datasets = datasets.filter((item) => item.points && item.points.length);

        _datasets.forEach(( oneline ) => {
            let defaultStyle = deepCopy(this._config.lineStyle);
            let style        = oneline.style || {};

            if ( !isPlainObject(style) )
                throw new Error('[LineChart] TypeMismatch：the style of dataset must be type of Object');

            for ( let key in style ) {
                if ( defaultStyle[key] ) {
                    if ( isPlainObject(defaultStyle[key]) )
                        defaultStyle[key] = extend( defaultStyle[key], style[key]);

                    else
                        defaultStyle[key] = style[key];
                }
            }

            oneline.style = defaultStyle;
        });

        this._alldatasets    = _datasets;
        this._datasets       = _datasets.filter( line => line.axis !== 2);
        this._secondDatasets = _datasets.filter( line => line.axis === 2);
    }

    /**
     * 数据清洗和合法性判断
     * 数据字段比较多，存在后面的函数调用依赖前面的计算结果的情况
     * 因此不能随便调换initData里面的函数顺序
     */
    initData(data) {
        // 原始调用者传入的数据
        this.initDataSets(data);

        // 如果没有有效数据，不执行绘制
        if ( !this._alldatasets.length ) {
            return;
        }

        // 为了绘制精确，首先要计算绘制的边界值，防止样式走位
        this.calBoundaryPoint();

        // 计算Y轴数据
        if ( this._datasets.length ) {
            this.calYAxis();
        }

        // 计算第二Y轴数据
        if ( this._secondDatasets.length ) {
            this.calSecondYAxis();
        }

        // 计算Y轴线条数据
        if ( this._datasets.length ) {
            this.calYAxisLines();
        }

        // 计算X轴数据
        this.calXAxis();

        // 计算X轴线条数据
        this.calXAxisLines();

        // 计算每条线的数据
        this.calPointData();

        this.log('initData');
    }

    clear() {
        this.clearCanvas(this.ctx1, this._config.width, this._config.height);
        this.clearCanvas(this.ctx2, this._config.width, this._config.height);
    }

    /**
     * 实际的绘制函数
     */
    draw(data, cfg = {}) {
        this._start = new Date();

        // this.clear(this.ctx1, this._config.width, this._config.height);
        this.clearCanvas(this.ctx2, this._config.width, this._config.height);

        this.getConfig(cfg, this._config);
        this.initData(data);

        if ( !this._alldatasets.length )
            return;

        this.drawToCanvas();

        this.ctx1.draw();

        this.log('realDraw');

        if ( this._config.debug ) {
            console.log(this, this._performance);
        }
    }

    /**
     * 触摸事件处理，绘制tooltip
     */
    touchHandler(e) {
        // 计算用于绘制tooltip的数据
        this.calToolTipData(e);

        if ( !this._render.toolTipData.currPoints.length ) {
            return;
        }

        /**
         * ctx2本身是为了性能优化存在的，如果没有ctx2，
         * 还是要把所用东西老老实实在ctx1上面绘制一遍
         */
        if ( this.ctx2 === this.ctx1 ) {
            this.drawToCanvas();
        }

        // 将tooltip绘制到对应的canvas
        this.drawToolTip();

        this.ctx2.draw();
    }

    /**
     * 处理触摸事件
     * 因为小程序触发这个事件的频率很高，而且绘制tooltip本身也需要一点时间
     * 这里会简单函数节流，保证触摸平滑
     */
    touch(e) {
        clearTimeout(this._touchTimer);

        /**
         * 小程序的touch频率远远大于5ms/次，这里定5ms是因为在有ctx2的情况下足够完成tooltip绘制
         * 保证触摸的丝滑体验。
         */
        this._touchTimer = setTimeout(() => {
            this.touchHandler(e);
        }, 5);
    }

    /**
     * tooltip在触摸结束之后是否需要保留可以通过是否调用这个函数决定
     */
    touchEnd() {
        /**
         * ctx2本身是为了性能优化存在的，如果没有ctx2，
         * 还是要把所用东西老老实实在ctx1上面绘制一遍
         */
        if ( this.ctx2 === this.ctx1 ) {
            this.drawToCanvas();
        }

        this.ctx2.draw();
    }
}

