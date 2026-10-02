#!/bin/sh
npx qx test --browsers=chromium --headless 
exit_code=$?
echo $exit_code
if [ $exit_code = 10 ]; then
    echo GOOD. Expected 10 tests to fail.
#    kill $pid
    exit 0
else
    echo BAD. Expected 10 tests to fail.    
#    kill $pid
    exit 1
fi
