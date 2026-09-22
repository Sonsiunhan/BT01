import http from 'k6/http';
import { check, sleep } from 'k6';

// 1. Cấu hình kịch bản chạy
export const options = {
    // Giả lập mức tải tăng dần
    stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '20s', target: 0 },
    ],
    // Tiêu chí đánh giá Pass / Fail (Thresholds)
    thresholds: {
        http_req_duration: ['p(95)<200'], // 95% số request phải hoàn thành dưới 200ms
        http_req_failed: ['rate<0.01'],
    },
};

// 2. Hàm chạy chính của mỗi Virtual User
export default function () {
    // Thay đổi URL theo địa chỉ thực tế của server cần test
    const res = http.get('http://localhost:8000');

    check(res, {
        'Status code là 200': (r) => r.status === 200,
    });

    sleep(1);
}