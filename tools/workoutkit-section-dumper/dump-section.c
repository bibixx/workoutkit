// dump-section — dlopen a Mach-O image and dump bytes of a named section to stdout.
//
// usage: dump-section <image-substring> <section> [segment=__TEXT] [extra-dlopen-path...]
//
// Example:
//   dump-section WorkoutKit __cstring __TEXT \
//     /System/Library/Frameworks/WorkoutKit.framework/WorkoutKit \
//     /System/Library/PrivateFrameworks/InternalSwiftProtobuf.framework/InternalSwiftProtobuf

#include <dlfcn.h>
#include <mach-o/dyld.h>
#include <mach-o/loader.h>
#include <mach-o/getsect.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

int main(int argc, char** argv) {
    if (argc < 3) {
        fprintf(stderr,
                "usage: %s <image-substring> <section> [segment=__TEXT] [extra-dlopen-path...]\n",
                argv[0]);
        return 2;
    }
    const char* target  = argv[1];
    const char* section = argv[2];
    const char* segment = (argc >= 4) ? argv[3] : "__TEXT";

    for (int i = 4; i < argc; i++) {
        if (!dlopen(argv[i], RTLD_NOW)) {
            fprintf(stderr, "# warn: dlopen(%s): %s\n", argv[i], dlerror());
        }
    }

    int matches = 0;
    uint32_t n = _dyld_image_count();
    for (uint32_t i = 0; i < n; i++) {
        const char* name = _dyld_get_image_name(i);
        if (!strstr(name, target)) continue;
        const struct mach_header_64* mh =
            (const struct mach_header_64*)_dyld_get_image_header(i);
        unsigned long size = 0;
        const uint8_t* sect = getsectiondata(mh, segment, section, &size);
        if (!sect) {
            fprintf(stderr, "# no %s,%s in %s\n", segment, section, name);
            continue;
        }
        fprintf(stderr, "# %s,%s from %s size=%lu\n", segment, section, name, size);
        fwrite(sect, 1, size, stdout);
        matches++;
    }
    if (matches == 0) {
        fprintf(stderr, "# error: no images matching '%s' were loaded\n", target);
        return 1;
    }
    return 0;
}
