import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Card, Text, Grid } from '@mantine/core';
import dayjs from 'dayjs';

import { ReportItem } from './SafetyReportsResponsive';

// Define Prop Interface
interface ReportChartsProps {
    data: ReportItem[];
    type: 'long-term' | 'traceability' | 'supply' | 'abnormal' | null;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function ReportCharts({ data, type }: ReportChartsProps) {
    if (!data || data.length === 0) return null;

    // 1. [Supply] Monthly Trend & Gas Distribution
    if (type === 'supply') {
        // Process        // Process Data: Group by Month
        const monthlyData = data.reduce((acc: Record<string, { name: string; total: number }>, item: ReportItem) => {
            const month = dayjs(item.date).format('YYYY-MM');
            if (!acc[month]) acc[month] = { name: month, total: 0 };
            acc[month].total += Number(item.quantity || 1);
            return acc;
        }, {});
        const chartData = Object.values(monthlyData).sort((a, b) => a.name.localeCompare(b.name));

        // Process Data: Group by Gas Type (Item)
        const gasData = data.reduce((acc: Record<string, { name: string; value: number }>, item: ReportItem) => {
            const gas = item.item || 'Unknown';
            if (!acc[gas]) acc[gas] = { name: gas, value: 0 };
            acc[gas].value += Number(item.quantity || 1);
            return acc;
        }, {});
        const pieData = Object.values(gasData);

        return (
            <Grid mb="md">
                <Grid.Col span={{ base: 12, md: 8 }}>
                    <Card withBorder style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }}>
                        <Text size="sm" fw={700} c="dimmed" mb="md">📅 월별 공급 추이</Text>
                        <div style={{ width: '100%', height: 250 }}>
                            <ResponsiveContainer>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                                    <XAxis dataKey="name" stroke="#888" />
                                    <YAxis stroke="#888" />
                                    <Tooltip contentStyle={{ backgroundColor: '#2C2E33', border: 'none', color: 'white' }} />
                                    <Line type="monotone" dataKey="total" stroke="#339AF0" strokeWidth={3} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                    <Card withBorder style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }}>
                        <Text size="sm" fw={700} c="dimmed" mb="md">📊 가스별 비중</Text>
                         <div style={{ width: '100%', height: 250 }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#2C2E33', border: 'none', color: 'white' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Grid.Col>
            </Grid>
        );
    }

    // 2. [Long Term] Days Held Distribution
    if (type === 'long-term') {
        // Group by Range: <180, 180-365, >365
        const ranges = { safe: 0, warning: 0, danger: 0 };
        data.forEach((item: ReportItem) => {
            if ((item.daysHeld || 0) > 365) ranges.danger++;
            else if ((item.daysHeld || 0) > 180) ranges.warning++;
            else ranges.safe++;
        });

        const barData = [
            { name: '6개월 미만', value: ranges.safe, fill: '#40C057' },
            { name: '6개월~1년', value: ranges.warning, fill: '#FCC419' },
            { name: '1년 이상', value: ranges.danger, fill: '#FA5252' },
        ];

        return (
             <Grid mb="md">
                <Grid.Col span={12}>
                    <Card withBorder style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }}>
                        <Text size="sm" fw={700} c="dimmed" mb="md">🚨 미반납 기간 분포</Text>
                        <div style={{ width: '100%', height: 250 }}>
                            <ResponsiveContainer>
                                <BarChart data={barData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                                    <XAxis type="number" stroke="#888" />
                                    <YAxis dataKey="name" type="category" width={100} stroke="#888" />
                                    <Tooltip contentStyle={{ backgroundColor: '#2C2E33', border: 'none', color: 'white' }} cursor={{fill: 'rgba(255,255,255,0.1)'}} />
                                    <Bar dataKey="value" barSize={40} radius={[0, 10, 10, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Grid.Col>
            </Grid>
        );
    }

    return null;
}
