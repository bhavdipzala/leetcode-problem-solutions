# LeetCode 1. Two Sum

- **LeetCode:** https://leetcode.com/problems/two-sum/
- **Difficulty:** ![Easy](https://img.shields.io/badge/-Easy-brightgreen)
- **Topics:** Array, Hash Table

## Approach

this is appro and so we have to do the same:<br>
ofcorsejjj

| Left | Center | Right |
|:-----|:------:|------:|
| Text | Text   | 123   |

hh

## Complexity

- **Time:** 2
- **Space:** 23

## Solution

```java
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
```

[Raw .java file](./two-sum.java)
