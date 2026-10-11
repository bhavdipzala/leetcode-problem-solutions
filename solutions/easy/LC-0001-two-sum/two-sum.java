/**
time: 2
approach: this is appro and so we have to do the same:
ofcorsejjj

| Left | Center | Right |
|:-----|:------:|------:|
| Text | Text   | 123   |

hh
time: 23 */


class Solution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++) {
            for (int j = i + 1; j < nums.length; j++) {
                if (nums[i] + nums[j] == target) {
                    return new int[] { i, j };
                }
            }
        }
        return new int[] {};
    }
}
