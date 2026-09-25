// Link with the quadrature solver sources; exercises all runtime-supported widths.
#include "quadrature_second_order_detail.h"
#include <cmath>
#include <iostream>
#include <future>
#include <stdexcept>
using namespace quadrature_second_order::detail;
int main() {
    std::vector<TetraCell> cells;
    for (int i=0; i<5; ++i) cells.push_back({0.,0.,-100.-i,10.,0.,-100.-i,0.,10.,-100.-i,0.,0.,-110.-i, i==2 ? -200. : 2600.});
    std::vector<Receiver> receivers;
    for (int i=0;i<19;++i) receivers.push_back({double(i*3-20),double(i-5),0.});
    auto reference = forward_gravity_quadrature_with_mode(receivers,cells,QuadratureExecutionMode::Tiled,1,3,3);
    std::vector<std::future<void>> jobs;
    for (int w : {2,4,8}) if (quadrature_simd_supports(w)) {
        std::cout << "Testing lanes " << w << std::endl;
        jobs.push_back(std::async(std::launch::async,[&,w] {
            for (int bs : {1,2,3,5,128}) for (auto mode : {QuadratureExecutionMode::SIMDTiled, QuadratureExecutionMode::SIMDTiledThreading}) {
                auto actual=forward_gravity_quadrature_with_mode(receivers,cells,mode,3,3,bs,w);
                for (size_t i=0;i<actual.size();++i)
                    if (std::abs(actual[i]-reference[i])>1e-12*std::abs(reference[i])) throw std::runtime_error("lane result mismatch");
            }
        }));
    }
    for(auto& job:jobs) job.get();
    std::cout << "All supported widths match scalar, including odd tiles and concurrent requests" << std::endl;
}
