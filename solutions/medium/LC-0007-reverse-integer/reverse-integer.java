/**
Approach:
- Initialise revNum = 0.
- Extract the last digit of the given number using x%10.
- Append the extracted last digit to the reversed number: revNum = revNum*10 + lastDig.
- Remove the last digit from the original given number using x = x/10.
- Repeat/loop while x != 0.
- Return reversed number.

Overflow handling:
Before performing revNum*10 + lastDig, check if it can cause positive or negative integer overflow, and if so, return 0.

Time: O(log10 |N|), process each digit only once.
Space: O(1), only a fixed number of variables.
*/


class Solution {
    public int reverse(int x) {

        int revNum = 0;
        int max = Integer.MAX_VALUE;
        int min = Integer.MIN_VALUE;

        while (x != 0) {
            int lastDig = x%10;

            if (revNum > max/10 || (revNum == max/10 && lastDig > max%10)){
                return 0;
            }
            if (revNum < min/10 || (revNum == min/10 && lastDig < min%10)){
                return 0;
            }
            
            revNum = revNum*10 + lastDig;
            
            x = x/10;
        }

        return revNum;
        
    }
}
