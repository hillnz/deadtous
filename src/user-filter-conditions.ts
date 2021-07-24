/* 
Return true if this user should be included.
A user is as defined at https://api.slack.com/types/user
*/
export function includeUser(user) {
    return user.deleted && !user.is_bot;
}
