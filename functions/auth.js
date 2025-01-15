// auth.js
function logout(req, res) {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error al cerrar sesión');
        }
        res.clearCookie('linkhub_dev_user');
        res.redirect('/');
    });
}

module.exports = { logout };