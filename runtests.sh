#!/bin/sh
npx qx test --browsers=chromium --headless
if [ $? = 5 ]; then
    echo GOOD. Expected 5 tests to fail.
#    kill $pid
    exit 0
else
    echo BAD. Expected 5 tests to fail.    
#    kill $pid
    exit 1
fi
