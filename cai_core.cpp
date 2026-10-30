// cai_core.cpp — KEI core: object counting (NMS) + GPS distance
// Build: clang++ -std=c++17 -O2 cai_core.cpp -o cai_core && ./cai_core
#include <algorithm>
#include <cmath>
#include <iostream>
#include <vector>

struct Box { float x1, y1, x2, y2, score; };

static float area(const Box& b) {
    return std::max(0.f, b.x2 - b.x1) * std::max(0.f, b.y2 - b.y1);
}

float iou(const Box& a, const Box& b) {
    Box i{std::max(a.x1, b.x1), std::max(a.y1, b.y1),
          std::min(a.x2, b.x2), std::min(a.y2, b.y2), 0.f};
    float inter = area(i);
    float uni = area(a) + area(b) - inter;
    return uni > 0.f ? inter / uni : 0.f;
}

std::vector<Box> nms(std::vector<Box> boxes, float scoreMin = 0.4f, float iouMax = 0.5f) {
    boxes.erase(std::remove_if(boxes.begin(), boxes.end(),
                [&](const Box& b) { return b.score < scoreMin; }), boxes.end());
    std::sort(boxes.begin(), boxes.end(),
              [](const Box& a, const Box& b) { return a.score > b.score; });
    std::vector<Box> keep;
    for (const Box& b : boxes) {
        bool ok = true;
        for (const Box& k : keep)
            if (iou(b, k) > iouMax) { ok = false; break; }
        if (ok) keep.push_back(b);
    }
    return keep;
}

inline size_t countObjects(const std::vector<Box>& raw) { return nms(raw).size(); }

double haversineKm(double lat1, double lon1, double lat2, double lon2) {
    const double R = 6371.0088, rad = M_PI / 180.0;
    double dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    double a = std::sin(dLat / 2) * std::sin(dLat / 2) +
               std::cos(lat1 * rad) * std::cos(lat2 * rad) *
               std::sin(dLon / 2) * std::sin(dLon / 2);
    return 2 * R * std::asin(std::sqrt(a));
}

int main() {
    std::vector<Box> det = {
        {10, 10, 100, 100, 0.95f}, {12, 12, 102, 98, 0.80f},
        {200, 50, 300, 150, 0.90f}, {400, 60, 480, 160, 0.30f},
    };
    std::cout << "Objects counted: " << countObjects(det) << "\n";
    std::cout << "Phnom Penh -> Siem Reap: "
              << haversineKm(11.5564, 104.9282, 13.3671, 103.8448) << " km\n";
    return 0;
}
