#!/bin/sh
npx qx test --browsers=chromium --headless 
exit_code=$?
echo $exit_code
if [ $exit_code = 7 ]; then
    echo GOOD. Expected 7 tests to fail.
#    kill $pid
    exit 0
else
    echo BAD. Expected 7 tests to fail.    
#    kill $pid
    exit 1
fi
