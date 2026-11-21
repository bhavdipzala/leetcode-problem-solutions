# LeetCode 507. Perfect Number

- **LeetCode:** https://leetcode.com/problems/perfect-number/
- **Difficulty:** ![Easy](https://img.shields.io/badge/-Easy-brightgreen)
- **Topics:** Math

## Approach

- 1 has no proper divisors (divisors other than itself), so return false.
- initialise sumOfDiv = 1, since 1 is a proper divisor of every num > 1.
- iterate from 2 upto sqrt(num) and find divisors in pairs:
  - if i is a divisor of num, then num/i is also a divisor.
  - if num/i == i, add it only once to avoid double-counting.
- compare and return true if sumOfDiv == num.

## Complexity

- **Time Complexity:** O(sqrt(N)), iterate only up to the square root of num.
- **Space Complexity:** O(1), only a fixed number of variables.

## Solution

```java
class Solution {
    public boolean checkPerfectNumber(int num) {

        if (num == 1) return false;
        int sumOfDiv = 1;

        for (int i = 2; i <= num/i; i++) {
            if (num % i == 0){
                sumOfDiv += i;
                if (num/i != i) {
                    sumOfDiv += num/i;
                }
            }
        }

        return sumOfDiv == num;
        
    }
}
```

[Raw .java file](./perfect-number.java)
