import OctohubShell from './OctohubShell';
import { Routes, Route, Navigate } from 'react-router-dom';
import { EventsOn } from '../../../../wailsjs/runtime/runtime';
import React, { useCallback, useEffect, useState } from 'react';
import OctohubHomePage from '../../../pages/octohub/OctohubHomePage';
import CommitHistoryPage from '../../../pages/octohub/CommitHistoryPage';
import { VerifyLogin, GetUserInfo } from '../../../../wailsjs/go/octohubHandler/OctohubHandler';

const OctohubModuleWrapper: React.FC = () => {
    const [githubUser, setGithubUser] = useState<any>(null);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

    const checkLogin = useCallback(async () => {
        try {
            const token = await VerifyLogin();
            if (token) {
                setIsLoggedIn(true);
                const user = await GetUserInfo();
                setGithubUser(user);
            } else {
                setIsLoggedIn(false);
                setGithubUser(null);
            }
        } catch (error) {
            setIsLoggedIn(false);
        }
    }, []);

    useEffect(() => {
        checkLogin();
        const unbind = EventsOn('login-success', (success: boolean) => {
            if (success) checkLogin();
        });
        return () => unbind();
    }, [checkLogin]);

    return (
        <OctohubShell isLoggedIn={isLoggedIn}>
            <Routes>
                <Route
                    path="/octohub/home"
                    element={
                        <OctohubHomePage
                            isLoggedIn={isLoggedIn}
                            githubUser={githubUser}
                            checkLogin={checkLogin}
                        />
                    }
                />
                <Route
                    path="/octohub/history"
                    element={
                        <CommitHistoryPage />
                    }
                />
                <Route path="/" element={<Navigate to="/octohub/home" replace />} />
                <Route path="/octohub" element={<Navigate to="/octohub/home" replace />} />
            </Routes>
        </OctohubShell>
    );
};

export default OctohubModuleWrapper;
