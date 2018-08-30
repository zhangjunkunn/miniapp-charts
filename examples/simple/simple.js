
import RadarChart from '../../src/radar.js';
Page({
    onLoad() {
        let context = wx.createCanvasContext('radar');

        this.radarchart = new RadarChart(context,
            {
                width : 400,
                height: 400,
            }
        );

        this.radarchart.draw(
            {
                labels  : ['输出', 'KDA', 'KDA', 'KDA', 'KDA'],
                datasets: [
                    {
                        data: [10, 80, 75, 90, 100],
                    }
                ]
            },
            {
                width : 400,
                height: 400,
            }
        );
    }
});

