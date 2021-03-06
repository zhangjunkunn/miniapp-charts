import common from './common.js';
import {
    extend
} from '../util.js';

let radarConfig = {
    width : 250,
    height: 250,

    animation      : true,
    animationStep  : 50,
    animationEasing: 'linear',

    padding: {
        left  : 5,
        right : 5,
        top   : 5,
        bottom: 5
    },

    // 有些雷达图会有Y轴，一般不展示，这里提供功能
    // TODO
    yAxisLine: {
        display: false,
        color  : '#B8B8B8',
    },

    grid: {
        display    : true,
        min        : 0,
        max        : 100,
        stepSize   : 20,
        width      : 1,
        color      : '#e3e3e3',
        style      : 'line',

        // 线条是虚线的默认配置
        dashPattern: [3],
        dashOffset : 0,
    },

    // 从原点往外辐射线的样式
    radiationLineStyle: {
        display    : true,
        dashPattern: [3],
        width      : 1,
        dashOffset : 0,
        color      : '#e3e3e3',
        style      : 'line',
    },

    label: {
        display   : true,
        color   : '#888888',
        fontSize: 12,
        margin: {
            left  : 3,
            right : 3,
            top   : 3,
            bottom: 3,
        }
    },

    // 单个雷达区域的配置
    datasetStyle: {
        label               : '',
        backgroundColor     : 'rgba(232, 245, 223, 0.7)',
        borderColor         : '#99d774',
        borderWidth         : 2,
        pointShow           : true,
        pointBackgroundColor: '#8dd364',
        pointBorderColor    : '#8dd364',
        pointBorderWidth    : 1,
        pointRadius         : 2,
    },

    // 雷达图的旋转角度
    startAngle: 0,
}

export default extend(radarConfig, common);

